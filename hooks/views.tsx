// What each site draws: Sakura's pane, the band, message avatars, the spinner word, /hf cast.
import type {
  HeavensFeelActivity,
  HeavensFeelAgent,
  HeavensFeelBubble,
  HeavensFeelCharacter,
  HeavensFeelMood,
  HeavensFeelTheme,
} from '../types'
import {
  blinkFrame,
  bustBlinkFrame,
  bustFrame,
  headFrame,
  isTalkingAt,
  miniFrame,
  moodLoop,
  portraitFrame,
  restingMini,
  type Frame,
  type PortraitSize,
  type Scene,
} from './anim'
import { badgeSuffix } from './cast'
import { gridToRaster, gridToSvg, hex, svgBox, type Backdrop, type Grid } from './render'
import { CAST } from './sprites'
import { PANE, rt, type Settings } from './state'
import { describeTool, localTime, sakuraVerb, servantVerb } from './voice'

/** One row of a subagent's conversation, as `$.session.messages({ agentId })` answers it. */
export type ServantMessage = {
  role: 'user' | 'assistant'
  text: string
  toolUses: readonly { tool: string; input: Record<string, unknown>; isError?: true; text?: string; result?: unknown }[]
}

/** The subagent the room is showing, with its conversation; `canGoBack` when the person chose it here. */
export type ServantView = { agent: HeavensFeelAgent; messages: readonly ServantMessage[]; canGoBack: boolean }

/** What the pane's buttons do; the hook builds these, since only it holds `$`. */
export type PaneControls = { view: (id: string) => void; back: () => void; openTasks: () => void }

/** What a drawing reads, read by the hook (the hook alone holds `$`). */
export type View = {
  mood: HeavensFeelMood
  isDark: boolean
  agents: Record<string, HeavensFeelAgent>
  bubble: HeavensFeelBubble
  ctx: number
  activity: HeavensFeelActivity
  theme: HeavensFeelTheme
  now: number
}

const DARK_ACCENT = 0xa81e2d
const PILL_TEXT = '#1a1320'
const GAUGE_WARN = 0xc0508a
const GAUGE_CELLS = 10
const HD_MIN_COLUMNS = 50
const HD_MIN_ROWS = 40
const ROSTER_LIMIT = 4
const SVG_PIXEL_HD = 4
const SVG_PIXEL_MINI = 4
const SVG_PIXEL_BUST = 3
const SVG_PIXEL_HEAD = 3
/** The band draws its own collapse mark, `[-]`, over the last cells of the first row. */
const BAND_MARK_COLUMNS = 4
/** Band room the HD bust needs (20 rows, 48 columns plus text), and the standard one (11 rows). */
const BAND_HD = { rows: 22, columns: 100 }
const BAND_SD = { rows: 12, columns: 56 }
/** Band rows that fit the bust beside a row of Servant minis (6 rows each, plus their names). */
const BAND_MINIS_ROWS = 14
const MINI_CARD_COLUMNS = 13
const SHORT_NAME_COLUMNS = 12
const TRANSCRIPT_ROWS = 14
const MESSAGE_CHARACTERS = 600
const SUMMONS_CHARACTERS = 160
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MOOD_LABEL: Readonly<Record<HeavensFeelMood, string>> = {
  idle: 'at home',
  thinking: 'thinking',
  editing: 'editing',
  searching: 'searching',
  running: 'running',
  summoning: 'summoning',
  ouch: 'flinching',
  done: 'finished',
  sleeping: 'dozing',
  interrupted: 'stopped',
}

export const nameOf = (agent: HeavensFeelAgent): string =>
  `${CAST[agent.character].name}${badgeSuffix(agent.badge)}${agent.isFork ? ' (fork)' : ''}`

/** "Rider · Servant of Sakura": the class, and whose Servant it is in the war. */
const allegianceOf = (character: HeavensFeelCharacter): string => {
  const entry = CAST[character]
  if (entry.role === 'master') return 'Master'
  const master = entry.master ? `Servant of ${CAST[entry.master].name.split(' ')[0]}` : 'masterless'
  return `${entry.className ?? 'Servant'} · ${master}`
}

const elapsed = (agent: HeavensFeelAgent, now: number): string => {
  const seconds = Math.max(0, Math.round(((agent.endedAt ?? now) - agent.startedAt) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

const statusOf = (agent: HeavensFeelAgent, now: number): string => {
  if (agent.isError) return `stumbled · ${elapsed(agent, now)}`
  if (agent.endedAt) return `done · ${elapsed(agent, now)}`
  return `${servantVerb(agent.character, agent.mood)} · ${agent.tools} tools · ${elapsed(agent, now)}`
}

const hearts = (turns: number): string => {
  const filled = [0, 10, 40, 120, 300].filter(threshold => turns >= threshold).length
  return '♥'.repeat(filled) + '♡'.repeat(5 - filled)
}

const sortedAgents = (all: Record<string, HeavensFeelAgent>): HeavensFeelAgent[] =>
  Object.values(all).sort((a, b) => Number(Boolean(a.endedAt)) - Number(Boolean(b.endedAt)) || a.startedAt - b.startedAt)

/** The scene now, from the module's mirrors: the same one the tick animates from. */
const sceneAt = (now: number, isSmil: boolean): Scene => ({
  mood: rt.mood,
  isDark: rt.isDark,
  now,
  isTalking: isTalkingAt(now, rt.talkUntil),
  isSmil,
})

const backdropFor = (theme: HeavensFeelTheme, accent: number): Backdrop => ({ theme, accent })

// Pieces ---------------------------------------------------------------------------

/** A Raster drawn with the frame for now and registered so the tick blits each later frame. */
const liveRaster = (ui: any, requestId: string, key: string, scale: 1 | 2, now: number, frameAt: (at: number) => Frame | null) => {
  const current = frameAt(now)
  if (!current) return null
  rt.rasters.set(key, { requestId, scale, frameAt })
  rt.blitted.set(key, current.key)
  const raster = gridToRaster(current.grid, scale)
  return <ui.Raster key={key} columns={raster.columns} rows={raster.rows} cells={raster.cells} />
}

const agentMiniAt = (id: string) => (at: number): Frame | null => {
  const agent = rt.agents[id]
  if (!agent) return null
  const mood = agent.endedAt ? 'idle' : agent.mood
  return miniFrame({ id, character: agent.character, mood, isDark: false, now: at })
}

/** Sakura as an Svg: her mood's frames loop, and while idle she blinks and breathes. */
const sakuraSvg = (ui: any, size: PortraitSize, frameOf: (scene: Scene) => Frame, blink: Frame, pixel: number, view: View) => {
  const loop = moodLoop(size, frameOf, sceneAt(view.now, true))
  const [first, ...rest] = loop.frames
  const isIdle = view.mood === 'idle' || view.mood === 'interrupted'
  const accent = view.isDark ? DARK_ACCENT : CAST.sakura.accent
  const source = gridToSvg(first!.grid, {
    pixel,
    frames: rest.map(one => one.grid),
    frameMs: loop.ms,
    blink: isIdle ? blink.grid : undefined,
    isBreathing: isIdle,
    backdrop: backdropFor(view.theme, accent),
  })
  const { width, height } = svgBox(first!.grid, pixel)
  return <ui.Svg source={source} alt={`Sakura Matou, ${MOOD_LABEL[view.mood]}`} width={width} height={height} isInteractive />
}

/** A mini sprite: a Raster the tick blits in the terminal, an Svg elsewhere, a dot where neither draws. */
const miniArt = (ui: any, surface: string, requestId: string, key: string, id: string, scale: 1 | 2, view: View) => {
  const frameAt = agentMiniAt(id)
  const character = rt.agents[id]?.character ?? 'sakura'
  const accent = CAST[character].accent
  if (surface === 'terminal') return liveRaster(ui, requestId, key, scale, view.now, frameAt)
  const current = frameAt(view.now)
  if ('Svg' in ui && current) {
    const pixel = SVG_PIXEL_MINI * scale
    const source = gridToSvg(current.grid, { pixel, backdrop: backdropFor(view.theme, accent) })
    return <ui.Svg source={source} alt={CAST[character].name} {...svgBox(current.grid, pixel)} />
  }
  return <ui.Text color={hex(accent)}>◆</ui.Text>
}

/** Context as Sakura's shadow: it fills toward the threshold where she turns. */
const shadowGauge = (ui: any, percent: number, threshold: number) => {
  const filled = Math.min(GAUGE_CELLS, Math.round((percent / 100) * GAUGE_CELLS))
  const isOver = threshold > 0 && percent >= threshold
  const color = isOver ? DARK_ACCENT : percent >= threshold - 25 ? GAUGE_WARN : CAST.sakura.accent
  return (
    <ui.Box flexDirection="row" columnGap={1}>
      <ui.Text dimColor>影 shadow</ui.Text>
      <ui.Text color={hex(color)}>{'▰'.repeat(filled)}</ui.Text>
      <ui.Text dimColor>{'▱'.repeat(GAUGE_CELLS - filled)}</ui.Text>
      <ui.Text color={hex(color)}>{Math.round(percent)}%</ui.Text>
    </ui.Box>
  )
}

const clockLine = (ui: any, now: number, settings: Settings, servants: number) => {
  const { hour, minute, weekday } = localTime(now, settings.timezone)
  const isNight = hour < 6 || hour >= 19
  const time = `${String(hour).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}`
  const company = servants > 0 ? ` · ✦ ${servants} Servant${servants > 1 ? 's' : ''} out` : ''
  return (
    <ui.Text dimColor>
      {isNight ? '☾' : '☀'} {time} {WEEKDAY_NAMES[weekday] ?? ''}
      {company}
    </ui.Text>
  )
}

const moodPill = (ui: any, mood: HeavensFeelMood, accent: number) => (
  <ui.Text backgroundColor={hex(accent)} color={PILL_TEXT} bold>
    {` ${MOOD_LABEL[mood]} `}
  </ui.Text>
)

const servantCard = (ui: any, surface: string, agent: HeavensFeelAgent, view: View, width: number, index: number, onView: () => void) => {
  const entry = CAST[agent.character]
  const accent = agent.isError ? DARK_ACCENT : entry.accent
  return (
    <ui.Box
      key={`card-${agent.id}`}
      flexDirection="row"
      columnGap={1}
      borderStyle="round"
      borderColor={hex(accent)}
      borderDimColor={Boolean(agent.endedAt)}
      paddingX={1}
      width={width}
    >
      {miniArt(ui, surface, PANE, `mini:${agent.id}`, agent.id, 1, view)}
      <ui.Box flexDirection="column" flexShrink={1} minWidth={0}>
        <ui.Box flexDirection="row" columnGap={1}>
          <ui.Text bold color={hex(accent)} dimColor={Boolean(agent.endedAt)} wrap="truncate-end">
            {nameOf(agent)}
          </ui.Text>
          <ui.Box flexGrow={1} />
          <ui.Button key={`view-${agent.id}`} label="view ▸" hotkey={String(index + 1)} plain onPress={onView} />
        </ui.Box>
        <ui.Text dimColor wrap="truncate-end">{allegianceOf(agent.character)}</ui.Text>
        <ui.Text color={hex(accent)} wrap="truncate-end">{agent.activity}</ui.Text>
        <ui.Text dimColor wrap="truncate-end">{statusOf(agent, view.now)}</ui.Text>
        <ui.Text dimColor italic wrap="truncate-end">「{agent.line}」</ui.Text>
      </ui.Box>
    </ui.Box>
  )
}

// Pane ---------------------------------------------------------------------------

type PaneEvent = {
  surface: string
  props: { bodyColumns: number; placement?: string }
  viewport?: { columns: number; rows: number }
}

const portraitSize = (e: PaneEvent): PortraitSize =>
  e.surface !== 'terminal' ||
  (e.props.placement === 'dock' && e.props.bodyColumns >= HD_MIN_COLUMNS && (e.viewport?.rows ?? 0) >= HD_MIN_ROWS)
    ? 'hd'
    : 'sd'

/** One transcript row: the summons, a reply, or a tool call with how it went. */
const transcriptRow = (ui: any, message: ServantMessage, index: number, accent: number) => {
  const { Box, Text } = ui
  if (message.role === 'user') {
    if (!message.text) return null
    return (
      <Box key={`row-${index}`} flexDirection="row" columnGap={1}>
        <Text color={hex(CAST.sakura.accent)}>❀</Text>
        <Text dimColor italic wrap="wrap">{clipText(message.text, SUMMONS_CHARACTERS)}</Text>
      </Box>
    )
  }
  return (
    <Box key={`row-${index}`} flexDirection="column">
      {message.text ? (
        <Box flexDirection="row" columnGap={1}>
          <Text color={hex(accent)}>●</Text>
          <Box flexShrink={1} minWidth={0}>
            <ui.Markdown text={clipText(message.text, MESSAGE_CHARACTERS)} />
          </Box>
        </Box>
      ) : null}
      {message.toolUses.map((use, k) => {
        const doing = describeTool(use.tool, use.input)
        const outcome = use.isError ? '✗' : use.text !== undefined || use.result !== undefined ? '✓' : '…'
        return (
          <Box key={`use-${index}-${k}`} flexDirection="row" columnGap={1}>
            <Text color={hex(use.isError ? DARK_ACCENT : accent)}>{outcome}</Text>
            <Text dimColor wrap="truncate-end">{doing.icon} {doing.text}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

const clipText = (text: string, length: number): string => (text.length > length ? `${text.slice(0, length - 1)}…` : text)

/** The room when it shows a Servant: its portrait, its state, and its own conversation, live. */
const drawServantRoom = (ui: any, e: PaneEvent, view: View, servant: ServantView, controls: PaneControls) => {
  const { Box, Text, Button } = ui
  const { agent, messages } = servant
  const entry = CAST[agent.character]
  const accent = agent.isError ? DARK_ACCENT : entry.accent
  const width = Math.max(10, e.props.bodyColumns - 2)
  const recent = messages.slice(-TRANSCRIPT_ROWS)
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" columnGap={2}>
        {servant.canGoBack ? <Button key="back" label="◂ Sakura" hotkey="b" plain onPress={controls.back} /> : null}
        <Box flexGrow={1} />
        {e.surface === 'terminal' ? <Button key="tasks" label="/tasks" hotkey="t" plain onPress={controls.openTasks} /> : null}
      </Box>
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text bold color={hex(accent)}>✦ {nameOf(agent)}</Text>
        <Text dimColor>{statusOf(agent, view.now)}</Text>
      </Box>
      <Text dimColor italic>{entry.title} · {allegianceOf(agent.character)}</Text>
      <Box justifyContent="center" marginY={1}>{miniArt(ui, e.surface, PANE, `viewed:${agent.id}`, agent.id, 2, view)}</Box>
      <Box flexDirection="row" columnGap={1}>
        {moodPill(ui, agent.endedAt ? 'done' : agent.mood, accent)}
        <Box flexShrink={1} minWidth={0}>
          <Text color={hex(accent)} wrap="truncate-end">{agent.activity}</Text>
        </Box>
      </Box>
      {agent.line ? (
        <Box borderStyle="round" borderColor={hex(accent)} paddingX={1} marginTop={1}>
          <Text wrap="wrap" italic>「{agent.line}」</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color={hex(accent)}>── ✦ {entry.name.split(' ')[0]}'s report ✦ ──</Text>
      </Box>
      <Text dimColor wrap="truncate-end">{agent.description}</Text>
      {recent.length === 0 ? <Text dimColor>Nothing to read yet. The summons has only begun.</Text> : null}
      {messages.length > recent.length ? <Text dimColor>… {messages.length - recent.length} earlier rows</Text> : null}
      {recent.map((message, i) => transcriptRow(ui, message, i, accent))}
    </Box>
  )
}

export const drawPane = (
  ui: any,
  e: PaneEvent,
  view: View,
  settings: Settings,
  bond: Record<string, number>,
  servant: ServantView | undefined,
  controls: PaneControls,
) => {
  if (servant) return drawServantRoom(ui, e, view, servant, controls)
  const { Box, Text } = ui
  const { mood: currentMood, isDark, agents: all, bubble: line, now } = view
  const isTerminal = e.surface === 'terminal'
  const accent = isDark ? DARK_ACCENT : CAST.sakura.accent
  const size = portraitSize(e)
  const width = Math.max(10, e.props.bodyColumns - 2)
  const roster = sortedAgents(all)
  const running = roster.filter(agent => !agent.endedAt).length

  const portrait = (() => {
    if (isTerminal) return liveRaster(ui, PANE, 'portrait', 1, now, at => portraitFrame(size, sceneAt(at, false)))
    if ('Svg' in ui) return sakuraSvg(ui, size, scene => portraitFrame(size, scene), blinkFrame(size, isDark), SVG_PIXEL_HD, view)
    return <Text color={hex(accent)}>{isDark ? '(◣_◢)' : '(´• ᴗ •`)'}</Text>
  })()

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={hex(accent)}>
          {isDark ? '✸' : '❀'} Sakura Matou
        </Text>
        <Text color={hex(accent)}>{hearts(bond.sakura ?? 0)}</Text>
      </Box>
      <Text dimColor italic>{isDark ? 'the shadow that waits at home' : `${CAST.sakura.title} · Master of Rider`}</Text>
      <Box justifyContent="center" marginY={1}>{portrait}</Box>
      <Box flexDirection="row" columnGap={1}>
        {moodPill(ui, currentMood, accent)}
        <Box flexShrink={1} minWidth={0}>
          <Text color={hex(accent)} wrap="truncate-end">{view.activity.icon} {view.activity.text}</Text>
        </Box>
      </Box>
      {line.text ? (
        <Box borderStyle="round" borderColor={hex(accent)} paddingX={1} marginTop={1}>
          <Text wrap="wrap" italic>「{line.text}」</Text>
        </Box>
      ) : null}
      <Box flexDirection="column" marginTop={1}>
        {shadowGauge(ui, view.ctx, settings.darkThreshold)}
        {clockLine(ui, now, settings, running)}
      </Box>
      {roster.length > 0 ? (
        <Box marginTop={1}>
          <Text color={hex(accent)}>── ✦ Servants ✦ ──</Text>
        </Box>
      ) : null}
      {roster.slice(0, ROSTER_LIMIT).map((agent, i) => servantCard(ui, e.surface, agent, view, width, i, () => controls.view(agent.id)))}
      {roster.length > ROSTER_LIMIT ? <Text dimColor>+{roster.length - ROSTER_LIMIT} more</Text> : null}
    </Box>
  )
}

// Message avatars ----------------------------------------------------------------

const shortName = (agent: HeavensFeelAgent | undefined): string =>
  agent ? CAST[agent.character].name.split(' ')[0]!.slice(0, SHORT_NAME_COLUMNS) : 'Sakura'

/** A reply wearing its author's face: Sakura for the main session, the Servant for a subagent's. */
export const drawAvatar = (
  ui: any,
  e: { surface: string },
  engineTree: unknown,
  agent: HeavensFeelAgent | undefined,
  isDark: boolean,
  theme: HeavensFeelTheme,
) => {
  const character = agent?.character ?? 'sakura'
  const isDarkFace = isDark && !agent
  const accent = isDarkFace ? DARK_ACCENT : CAST[character].accent
  const head = headFrame(character, isDarkFace).grid
  const face = (() => {
    if (e.surface === 'terminal') {
      const raster = gridToRaster(head, 1)
      return <ui.Raster key="face" columns={raster.columns} rows={raster.rows} cells={raster.cells} />
    }
    if ('Svg' in ui) {
      const source = gridToSvg(head, { pixel: SVG_PIXEL_HEAD, backdrop: backdropFor(theme, accent) })
      return <ui.Svg source={source} alt={CAST[character].name} {...svgBox(head, SVG_PIXEL_HEAD)} />
    }
    return <ui.Text color={hex(accent)}>◆</ui.Text>
  })()
  return (
    <ui.Box flexDirection="row" columnGap={1}>
      <ui.Box flexDirection="column" flexShrink={0} width={SHORT_NAME_COLUMNS} alignItems="center">
        {face}
        <ui.Text color={hex(accent)} wrap="truncate-end">{shortName(agent)}</ui.Text>
      </ui.Box>
      {/* No sizing or placing prop on any Box above the engine's own drawing: the engine refuses it. */}
      <ui.Box flexGrow={1} flexShrink={1}>
        {engineTree}
      </ui.Box>
    </ui.Box>
  )
}

// Band ---------------------------------------------------------------------------

type BandEvent = { surface: string; requestId: string; props: { bodyColumns: number; maxRows: number } }

const bustSize = (ui: any, e: BandEvent): PortraitSize | null => {
  if (e.surface !== 'terminal') return 'Svg' in ui ? 'hd' : null
  const { maxRows, bodyColumns } = e.props
  if (maxRows >= BAND_HD.rows && bodyColumns >= BAND_HD.columns) return 'hd'
  if (maxRows >= BAND_SD.rows && bodyColumns >= BAND_SD.columns) return 'sd'
  return null
}

export const drawBand = (ui: any, e: BandEvent, view: View, openPane: () => void) => {
  const { Box, Text, Button } = ui
  const { mood: currentMood, isDark, agents: all, bubble: line, now } = view
  const accent = isDark ? DARK_ACCENT : CAST.sakura.accent
  const running = sortedAgents(all)
  const width = Math.max(20, e.props.bodyColumns - 2)
  const firstRowWidth = Math.max(18, e.props.bodyColumns - BAND_MARK_COLUMNS)
  const size = bustSize(ui, e)
  const openButton = (
    <Box flexShrink={0}>
      <Button key="open" label="open pane" plain onPress={openPane} />
    </Box>
  )
  const nameplate = (
    <Box flexShrink={0} columnGap={1}>
      <Text color={hex(accent)}>{isDark ? '✸' : '❀'}</Text>
      <Text bold color={hex(accent)}>Sakura</Text>
      {moodPill(ui, currentMood, accent)}
    </Box>
  )
  const chips = running.length > 0 ? (
    <Box flexDirection="row" columnGap={2} flexWrap="wrap">
      {running.map(agent => (
        <Box key={`chip-${agent.id}`} flexDirection="row" columnGap={1}>
          <Text color={hex(CAST[agent.character].accent)}>◆</Text>
          <Text dimColor={Boolean(agent.endedAt)}>{nameOf(agent)}</Text>
          <Text dimColor wrap="truncate-end">{agent.activity}</Text>
        </Box>
      ))}
    </Box>
  ) : null

  if (!size) {
    return (
      <Box flexDirection="column" width={width}>
        <Box flexDirection="row" columnGap={1} width={firstRowWidth}>
          {nameplate}
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Text italic wrap="truncate-end">{line.text ? `「${line.text}」` : ''}</Text>
          </Box>
          {openButton}
        </Box>
        {chips}
      </Box>
    )
  }

  const isTerminal = e.surface === 'terminal'
  const portrait = isTerminal
    ? liveRaster(ui, e.requestId, 'band-portrait', 1, now, at => bustFrame(size, sceneAt(at, false)))
    : sakuraSvg(ui, size, scene => bustFrame(size, scene), bustBlinkFrame(size, isDark), SVG_PIXEL_BUST, view)
  const showMinis = running.length > 0 && (!isTerminal || e.props.maxRows >= BAND_MINIS_ROWS)
  const textColumns = Math.max(16, firstRowWidth - (isTerminal ? 48 : 30) - 2)
  const fitting = Math.max(1, Math.floor(textColumns / MINI_CARD_COLUMNS))
  const minis = showMinis ? (
    <Box flexDirection="row" columnGap={1}>
      {running.slice(0, fitting).map(agent => (
        <Box key={`band-card-${agent.id}`} flexDirection="column" width={MINI_CARD_COLUMNS - 1}>
          {miniArt(ui, e.surface, e.requestId, `band-mini:${agent.id}`, agent.id, 1, view)}
          <Text bold color={hex(CAST[agent.character].accent)} wrap="truncate-end">{nameOf(agent)}</Text>
          <Text dimColor wrap="truncate-end">{agent.endedAt ? 'done' : servantVerb(agent.character, agent.mood)}</Text>
        </Box>
      ))}
    </Box>
  ) : chips

  return (
    <Box flexDirection="row" columnGap={2} width={firstRowWidth}>
      <Box flexShrink={0}>{portrait}</Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Box flexDirection="row" columnGap={1}>
          {nameplate}
          <Box flexGrow={1} />
          {openButton}
        </Box>
        <Text color={hex(accent)} wrap="truncate-end">
          {view.activity.icon} {view.activity.text}
        </Text>
        {line.text ? (
          <Box borderStyle="round" borderColor={hex(accent)} paddingX={1}>
            <Text wrap="wrap" italic>「{line.text}」</Text>
          </Box>
        ) : null}
        {minis}
      </Box>
    </Box>
  )
}

// Spinner -----------------------------------------------------------------------

export const spinnerWord = (agent: HeavensFeelAgent | undefined, currentMood: HeavensFeelMood, isDark: boolean): string =>
  agent ? `${nameOf(agent)} is ${servantVerb(agent.character, agent.mood)}` : `Sakura is ${sakuraVerb(currentMood, isDark)}`

// /hf cast ----------------------------------------------------------------------

export const CAST_MARKER = '✿ The cast of Heaven\'s Feel'

export const castText = (bond: Record<string, number>, assigned: readonly HeavensFeelAgent[]): string => {
  const lines = Object.values(CAST).map(entry => {
    const now = assigned.filter(agent => agent.character === entry.id && !agent.endedAt)
    const on = now.length > 0 ? `  ← ${now.map(agent => agent.description || agent.type).join(', ')}` : ''
    return `${entry.name.padEnd(14)} ${entry.title.padEnd(28)} ${hearts(bond[entry.id] ?? 0)}${on}`
  })
  return [CAST_MARKER, ...lines].join('\n')
}

export const drawCast = (ui: any, e: { surface: string }, bond: Record<string, number>, theme: HeavensFeelTheme) => {
  const { Box, Text } = ui
  const card = (id: HeavensFeelCharacter) => {
    const entry = CAST[id]
    const art = restingMini(id).grid
    const picture = (grid: Grid) => {
      if (e.surface === 'terminal') {
        const raster = gridToRaster(grid, 1)
        return <ui.Raster key={`cast-${id}`} columns={raster.columns} rows={raster.rows} cells={raster.cells} />
      }
      if ('Svg' in ui) {
        const source = gridToSvg(grid, { pixel: SVG_PIXEL_MINI, backdrop: backdropFor(theme, entry.accent) })
        return <ui.Svg source={source} alt={entry.name} {...svgBox(grid, SVG_PIXEL_MINI)} />
      }
      return <Text color={hex(entry.accent)}>◆</Text>
    }
    return (
      <Box key={`card-${id}`} flexDirection="column" alignItems="center" width={16} borderStyle="round" borderColor={hex(entry.accent)}>
        {picture(art)}
        <Text bold color={hex(entry.accent)} wrap="truncate-end">{entry.name}</Text>
        <Text dimColor wrap="truncate-end">{entry.title}</Text>
        <Text dimColor wrap="truncate-end">{allegianceOf(id)}</Text>
        <Text color={hex(entry.accent)}>{hearts(bond[id] ?? 0)}</Text>
      </Box>
    )
  }
  const ids = Object.keys(CAST) as HeavensFeelCharacter[]
  const section = (label: string, role: 'master' | 'servant') => (
    <Box flexDirection="column">
      <Text color={hex(CAST.sakura.accent)}>── ✦ {label} ✦ ──</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1}>
        {ids.filter(id => CAST[id].role === role).map(card)}
      </Box>
    </Box>
  )
  return (
    <Box flexDirection="column" rowGap={1}>
      <Text bold color={hex(CAST.sakura.accent)}>{CAST_MARKER}</Text>
      {section('Masters', 'master')}
      {section('Servants · your subagents', 'servant')}
    </Box>
  )
}
