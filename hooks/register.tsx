// heavens-feel: Sakura watches over the main session; a Servant answers every subagent.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { HeavensFeelActivity, HeavensFeelAgent, HeavensFeelBubble, HeavensFeelMood, HeavensFeelTheme } from '../types'
import { cast, masterForMessage, moodForTool } from './cast'
import { gridToRaster } from './render'
import { CAST } from './sprites'
import { PANE, readSettings, rt, type DarkOverride, type Settings } from './state'
import { castText, CAST_MARKER, drawAvatar, drawBand, drawCast, drawPane, nameOf, spinnerWord, type View } from './views'
import { activityLine, describeTool, greeting, idleLine, localTime, sakuraLine, servantLine } from './voice'

type $ = EngineInterface

// The session's atoms: host-held, so they survive a hot reload.
const mood = atom({ plugin: 'heavens-feel', key: 'mood' } as const, 'idle' as HeavensFeelMood)
const dark = atom({ plugin: 'heavens-feel', key: 'dark' } as const, false)
const ctx = atom({ plugin: 'heavens-feel', key: 'ctx' } as const, 0)
const agents = atom({ plugin: 'heavens-feel', key: 'agents' } as const, {} as Record<string, HeavensFeelAgent>)
const bubble = atom({ plugin: 'heavens-feel', key: 'bubble' } as const, { text: '', at: 0 } as HeavensFeelBubble)
const paneVisible = atom({ plugin: 'heavens-feel', key: 'paneVisible' } as const, false)
const activity = atom({ plugin: 'heavens-feel', key: 'activity' } as const, { icon: '✿', text: 'at home', at: 0 } as HeavensFeelActivity)
const theme = atom({ plugin: 'heavens-feel', key: 'theme' } as const, 'auto' as HeavensFeelTheme)
const viewing = atom({ plugin: 'heavens-feel', key: 'viewing' } as const, '')

const TICK_MS = 100
const TALK_MS = 1200
const LINE_GAP_MS = 2500
const SERVANT_LINE_EVERY = 3
const MAX_MESSAGE_AGENTS = 2000
const POLL_MS = 2000
const FORGET_AGENT_MS = 12000
const DARK_HYSTERESIS = 10
const ERROR_STREAK_DARK = 3
const PANE_COLUMNS = 52
const PANE_TITLE = "Sakura's room"

const HOLDS: Partial<Record<HeavensFeelMood, number>> = { ouch: 1800, done: 4000, interrupted: 2000, summoning: 800 }

const STORE_PANE_OPEN = 'paneOpen'
const STORE_DARK_OVERRIDE = 'darkOverride'
const STORE_BOND = 'bond'

const USAGE = [
  '/hf                  toggle Sakura\'s pane',
  '/hf on | off         open or close it',
  '/hf cast             the whole cast, with bond hearts',
  '/hf dark [on|off|auto]  Dark Sakura override',
  '/hf say              a fresh line',
  '/hf sleep            let her doze off',
  '/hf bond             bond hearts per character',
].join('\n')

let settings: Settings = readSettings({})
let bond: Record<string, number> = {}


const say = async ($: $, text: string) => {
  const now = await $.clock.now()
  rt.talkUntil = now + TALK_MS
  rt.lastLineAt = now
  await update($, bubble, () => ({ text, at: now }))
}

const setMood = async ($: $, next: HeavensFeelMood, options: { line?: boolean } = {}) => {
  const now = await $.clock.now()
  const changed = rt.mood !== next
  rt.mood = next
  rt.lastActivity = now
  rt.moodToken += 1
  const token = rt.moodToken
  if (changed) await update($, mood, () => next)
  const isLoud = next === 'done' || next === 'ouch' || next === 'summoning' || next === 'interrupted'
  if (options.line !== false && changed && (isLoud || now - rt.lastLineAt > LINE_GAP_MS)) {
    await say($, next === 'idle' ? idleLine(localTime(now, settings.timezone), rt.isDark) : sakuraLine(next, rt.isDark))
  }
  const hold = HOLDS[next]
  if (hold) {
    $.clock.after(hold, () => {
      if (rt.moodToken !== token) return
      void setMood($, rt.isTurnRunning ? 'thinking' : 'idle', { line: false })
    })
  }
}

const setActivity = async ($: $, icon: string, text: string) => {
  const now = await $.clock.now()
  await update($, activity, () => ({ icon, text, at: now }))
}

const themeOf = (value: unknown): HeavensFeelTheme => {
  const name = String(value ?? '').toLowerCase()
  if (name.includes('light')) return 'light'
  if (name.includes('dark')) return 'dark'
  return 'auto'
}

const wake = async ($: $) => {
  if (rt.mood !== 'sleeping') return
  await setMood($, 'idle', { line: false })
  await say($, sakuraLine('wake', rt.isDark))
}

const setAgent = async ($: $, id: string, change: (agent: HeavensFeelAgent) => HeavensFeelAgent) => {
  const agent = rt.agents[id]
  if (!agent) return
  const changed = change(agent)
  rt.agents = { ...rt.agents, [id]: changed }
  await update($, agents, all => ({ ...all, [id]: changed }))
}

const forgetAgent = async ($: $, id: string) => {
  const { [id]: gone, ...rest } = rt.agents
  if (gone) rt.pastAgents.set(id, gone)
  rt.agents = rest
  for (const key of [...rt.rasters.keys()].filter(one => one.endsWith(`:${id}`))) {
    rt.rasters.delete(key)
    rt.blitted.delete(key)
  }
  await update($, agents, () => rest)
}

const finishAgent = async ($: $, id: string, isError: boolean) => {
  const agent = rt.agents[id]
  if (!agent || agent.endedAt) return
  const now = await $.clock.now()
  await setAgent($, id, one => ({
    ...one,
    mood: isError ? 'ouch' : 'done',
    endedAt: now,
    isError,
    line: servantLine(one.character, isError ? 'error' : 'done'),
  }))
  await addBond($, agent.character)
  $.clock.after(FORGET_AGENT_MS, () => void forgetAgent($, id))
}

const addBond = async ($: $, character: string) => {
  bond = { ...bond, [character]: (bond[character] ?? 0) + 1 }
  await $.store.set(STORE_BOND, bond)
}

const evaluateDark = async ($: $) => {
  const threshold = settings.darkThreshold
  const isOverThreshold = threshold > 0 && rt.ctx >= (rt.isDarkByAuto ? threshold - DARK_HYSTERESIS : threshold)
  rt.isDarkByAuto = isOverThreshold || rt.errorStreak >= ERROR_STREAK_DARK
  const next = rt.darkOverride === 'on' ? true : rt.darkOverride === 'off' ? false : rt.isDarkByAuto
  if (next === rt.isDark) return
  rt.isDark = next
  await update($, dark, () => next)
  await say($, sakuraLine(next ? 'enter' : 'exit', next))
  if (next && rt.canDraw && rt.darkOverride !== 'on') {
    const why = isOverThreshold ? `context ${Math.round(rt.ctx)}%` : `${rt.errorStreak} errors in a row`
    $.ui.toast(`Sakura is not herself (${why}). /compact helps, or /hf dark off.`)
  }
}

const openPane = async ($: $, focus: boolean) => {
  const placed = await $.ui.open({ id: PANE, title: "Sakura's room", columns: PANE_COLUMNS, ...(focus ? { focus: true } : {}) })
  await update($, paneVisible, () => placed.isPlaced)
  await $.store.set(STORE_PANE_OPEN, true)
  return placed
}

const closePane = async ($: $) => {
  await $.ui.close({ id: PANE })
  await update($, paneVisible, () => false)
  await $.store.set(STORE_PANE_OPEN, false)
}

let lastPollAt = 0
let lastRedrawSecond = 0

const tick = async ($: $) => {
  const now = await $.clock.now()
  const sleepMs = settings.sleepAfterMinutes * 60_000
  if (sleepMs > 0 && rt.mood === 'idle' && !rt.isTurnRunning && now - rt.lastActivity > sleepMs) {
    await setMood($, 'sleeping')
  }
  for (const [key, live] of rt.rasters) {
    const current = live.frameAt(now)
    if (!current) {
      rt.rasters.delete(key)
      continue
    }
    if (rt.blitted.get(key) === current.key) continue
    rt.blitted.set(key, current.key)
    const { cells } = gridToRaster(current.grid, live.scale)
    const blit = await $.ui.blit({ requestId: live.requestId, key, cells })
    if (blit.deny) rt.rasters.delete(key)
  }
  const hasRunning = Object.values(rt.agents).some(agent => !agent.endedAt)
  const second = Math.floor(now / 1000)
  if (hasRunning && second !== lastRedrawSecond) {
    lastRedrawSecond = second
    $.ui.invalidate('ui.render')
  }
  if (now - lastPollAt >= POLL_MS) {
    lastPollAt = now
    rt.surfaces = await $.session.surfaces()
    if (hasRunning) await reconcileAgents($)
  }
}

/** Agents killed or failed without a turn.complete still leave the roster. */
/** Everything a drawing shows; reading it subscribes the drawing to each atom. */
const readView = async ($: $): Promise<View> => {
  const [currentMood, isDark, all, line, percent, doing, currentTheme, now] = await Promise.all([
    read($, mood),
    read($, dark),
    read($, agents),
    read($, bubble),
    read($, ctx),
    read($, activity),
    read($, theme),
    $.clock.now(),
  ])
  return { mood: currentMood, isDark, agents: all, bubble: line, ctx: percent, activity: doing, theme: currentTheme, now }
}

/** A subagent's own conversation, or nothing when the session cannot read it. */
const agentMessages = async ($: $, agentId: string): Promise<readonly SessionMessage[]> => {
  const found = await $.session.messages({ agentId })
  return Array.isArray(found) ? found : []
}

// Render trace: what each surface asked the mod to draw, to diagnose surfaces with no visible log.
const TRACE_LIMIT = 200
const renderTrace: string[] = []

/** Never throws: a diagnostic must not break a drawing. */
const traceRender = async ($: $, entry: Record<string, unknown>) => {
  if (renderTrace.length >= TRACE_LIMIT) return
  try {
    renderTrace.push(JSON.stringify({ at: await $.clock.now(), ...entry }))
    await $.fs.write(`${$.plugin.root}/.debug/render.jsonl`, `${renderTrace.join('\n')}\n`)
  } catch {
    // Nothing to do: the trace is best effort.
  }
}

/** The shape of a tree the engine handed back, a few levels deep, for the trace. */
const shapeOf = (node: unknown, depth = 0): unknown => {
  if (depth > 3 || node === null || typeof node !== 'object') return typeof node === 'string' ? 'text' : node
  const { type, props, children } = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown[] }
  return { type, props: props ? Object.keys(props) : [], children: (children ?? []).slice(0, 4).map(child => shapeOf(child, depth + 1)) }
}

const reconcileAgents = async ($: $) => {
  const listed = new Map((await $.agent.list()).map(info => [info.id, info.status]))
  for (const agent of Object.values(rt.agents)) {
    const status = listed.get(agent.id)
    if (agent.endedAt || status === undefined || status === 'running') continue
    await finishAgent($, agent.id, status !== 'completed')
  }
}

export const register: Register = (on, options) => {
  settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hf',
      description: "Sakura's pane and the Heaven's Feel cast",
      argumentHint: '[on|off|cast|dark|say|sleep|bond]',
      immediate: true,
    })
    rt.canDraw = e.isInteractive && e.surface !== null
    const [storedBond, storedOverride, storedPaneOpen] = await Promise.all([
      $.store.get(STORE_BOND),
      $.store.get(STORE_DARK_OVERRIDE),
      $.store.get(STORE_PANE_OPEN),
    ])
    bond = (storedBond as Record<string, number> | undefined) ?? {}
    rt.darkOverride = (storedOverride as DarkOverride | undefined) ?? null
    const now = await $.clock.now()
    rt.lastActivity = now
    // A hot reload keeps the atoms; pick their values back up.
    rt.mood = await read($, mood)
    rt.isDark = await read($, dark)
    // Agents cast before subagents were Servants only would wear a Master's face: let them go.
    const restored = await read($, agents)
    rt.agents = Object.fromEntries(Object.entries(restored).filter(([, agent]) => CAST[agent.character].role === 'servant'))
    if (Object.keys(rt.agents).length !== Object.keys(restored).length) await update($, agents, () => rt.agents)
    rt.ctx = (await $.session.usage()).context.percent ?? 0
    const themeRow = (await $.config.list()).find(row => row.key === 'theme')
    await update($, theme, () => themeOf(themeRow?.value))
    await update($, ctx, () => rt.ctx)
    await evaluateDark($)
    if (!rt.canDraw) return next(e)
    rt.surfaces = await $.session.surfaces()
    if (!(await read($, bubble)).text) await say($, greeting(localTime(now, settings.timezone)))
    if (settings.paneOnStart && storedPaneOpen !== false) {
      const placed = await $.ui.open({ id: PANE, title: PANE_TITLE, columns: PANE_COLUMNS })
      await update($, paneVisible, () => placed.isPlaced)
    }
    let isTicking = false
    $.clock.every(TICK_MS, () => {
      if (isTicking) return
      isTicking = true
      tick($)
        .catch(() => {})
        .finally(() => {
          isTicking = false
        })
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      rt.agents = {}
      rt.errorStreak = 0
      rt.isTurnRunning = false
      await update($, agents, () => ({}))
      await setMood($, 'idle', { line: false })
      await say($, "I'm still here, Senpai. Clean slate.")
      await evaluateDark($)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await wake($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    rt.isTurnRunning = true
    await wake($)
    await setMood($, 'thinking')
    await setActivity($, '❀', 'thinking it through')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      await finishAgent($, e.agentId, e.reason === 'error' || e.reason === 'refusal')
      return next(e)
    }
    rt.isTurnRunning = false
    if (e.isAborted) {
      await setMood($, 'interrupted')
    } else if (e.reason === 'answer') {
      rt.errorStreak = 0
      await setMood($, 'done')
      await setActivity($, '✿', 'finished, waiting for you')
      await addBond($, 'sakura')
    } else {
      await setMood($, 'ouch')
    }
    await evaluateDark($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const toolMood = moodForTool(e.tool)
    const doing = describeTool(e.tool, e as unknown as Record<string, unknown>)
    const agentId = e.agentId
    if (agentId && rt.agents[agentId]) {
      await setAgent($, agentId, agent => ({
        ...agent,
        mood: toolMood,
        activity: `${doing.icon} ${doing.text}`,
        tools: agent.tools + 1,
        ...(agent.tools % SERVANT_LINE_EVERY === 0 ? { line: servantLine(agent.character, 'working') } : {}),
      }))
    } else if (!agentId) {
      await wake($)
      const now = await $.clock.now()
      const isNewMood = rt.mood !== toolMood
      await setMood($, toolMood, { line: false })
      await setActivity($, doing.icon, doing.text)
      if (isNewMood || now - rt.lastLineAt > LINE_GAP_MS) await say($, activityLine(toolMood, rt.isDark, doing.target))
    }
    const result = await next(e)
    if (agentId && rt.agents[agentId]) {
      await setAgent($, agentId, agent => ({
        ...agent,
        mood: 'thinking',
        ...(result.isError ? { line: servantLine(agent.character, 'error'), activity: `✗ ${doing.text} failed` } : {}),
      }))
    } else if (!agentId) {
      rt.errorStreak = result.isError ? rt.errorStreak + 1 : 0
      if (result.isError) {
        await setMood($, 'ouch')
        await setActivity($, '✗', `${doing.text} failed`)
      } else if (toolMood !== 'summoning') {
        await setMood($, rt.isTurnRunning ? 'thinking' : 'idle', { line: false })
      }
      await evaluateDark($)
    }
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (!result.agentId) return result
    const running = Object.values(rt.agents).filter(agent => !agent.endedAt)
    const casting = cast(e.subagentType, running)
    const now = await $.clock.now()
    const agent: HeavensFeelAgent = {
      id: result.agentId,
      character: casting.character,
      badge: casting.badge,
      type: e.subagentType,
      description: e.description,
      isFork: e.fork || e.subagentType === 'fork',
      mood: 'thinking',
      startedAt: now,
      isError: false,
      line: servantLine(casting.character, 'spawn'),
      activity: '✦ answering the summons',
      tools: 0,
    }
    rt.agents = { ...rt.agents, [agent.id]: agent }
    await update($, agents, all => ({ ...all, [agent.id]: agent }))
    if (!e.parentAgentId) await setMood($, 'summoning', { line: false })
    if (!e.parentAgentId) await say($, `${nameOf(agent)}, please: ${e.description}.`)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent
    if (percent !== undefined && Math.round(percent) !== Math.round(rt.ctx)) {
      rt.ctx = percent
      await update($, ctx, () => percent)
      await evaluateDark($)
    }
    return next(e)
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    if (!result.deny) await update($, theme, () => themeOf(result.value))
    return result
  })

  // Which agent wrote each assistant row, so its message can wear that agent's face.
  on('session.append', async ($, e, next) => {
    const result = await next(e)
    const uuid = result.uuid ?? e.uuid
    if (e.agentId && e.message.role === 'assistant' && uuid) {
      rt.messageAgents.set(uuid, e.agentId)
      if (rt.messageAgents.size > MAX_MESSAGE_AGENTS) rt.messageAgents.delete(rt.messageAgents.keys().next().value!)
    }
    return result
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    // The terminal marks the block that opens a reply; other surfaces may never set the mark.
    const isAvatarBlock = e.props.isFirstOfReply || e.surface !== 'terminal'
    void traceRender($, { surface: e.surface, component: e.component, requestId: e.requestId, isFirstOfReply: e.props.isFirstOfReply, textLength: e.props.text.length })
    if (!isAvatarBlock) return next(e)
    const agentId = rt.messageAgents.get(e.requestId)
    const [all, isDark, currentTheme] = await Promise.all([read($, agents), read($, dark), read($, theme)])
    const agent = agentId ? all[agentId] ?? rt.pastAgents.get(agentId) : undefined
    const speaker = agent?.character ?? masterForMessage(e.requestId)
    const engineTree = await next(e)
    void traceRender($, { surface: e.surface, requestId: e.requestId, speaker, engine: shapeOf(engineTree) })
    return drawAvatar($.ui.resolve(e), e, engineTree, speaker, isDark, currentTheme)
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    for (const [key, live] of rt.rasters) {
      if (live.requestId === PANE) rt.rasters.delete(key)
    }
    await update($, paneVisible, () => false)
    if (e.origin.kind === 'person') await $.store.set(STORE_PANE_OPEN, false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    void traceRender($, { surface: e.surface, component: e.component, placement: e.props.placement, bodyColumns: e.props.bodyColumns, viewport: e.viewport })
    const view = await readView($)
    const chosen = (await read($, viewing)) || e.props.view.agentId || ''
    const agent = chosen ? (view.agents[chosen] ?? rt.pastAgents.get(chosen)) : undefined
    const servant = agent ? { agent, messages: await agentMessages($, agent.id), canGoBack: !e.props.view.agentId } : undefined
    const controls = {
      view: (id: string) => void update($, viewing, () => id),
      back: () => void update($, viewing, () => ''),
      openTasks: () => void $.command.run({ command: 'tasks' }).catch(() => {}),
    }
    return drawPane($.ui.resolve(e), e, view, settings, bond, servant, controls)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || settings.band === 'never') return next(e)
    if (settings.band === 'auto' && (await read($, paneVisible))) return next(e)
    return drawBand($.ui.resolve(e), e, await readView($), () => void openPane($, true))
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (settings.spinnerTakeover === 'off') return next(e)
    const [all, currentMood, isDark] = await Promise.all([read($, agents), read($, mood), read($, dark)])
    const word = spinnerWord(all[e.requestId], currentMood, isDark)
    return next({ ...e, props: { ...e.props, word } })
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'hf' } }, async ($, e, next) => {
    if (!e.props.text.startsWith(CAST_MARKER)) return next(e)
    return drawCast($.ui.resolve(e), e, bond, await read($, theme))
  })

  on('command.run', { command: 'hf' }, async ($, e) => {
    const [sub = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    switch (sub) {
      case '':
        if (await read($, paneVisible)) {
          await closePane($)
          return { text: 'Sakura waves goodbye. /hf brings her back.' }
        }
        await openPane($, true)
        return {}
      case 'on':
        await openPane($, true)
        return {}
      case 'off':
        await closePane($)
        return { text: 'Pane closed.' }
      case 'cast':
        return { text: castText(bond, Object.values(rt.agents)) }
      case 'dark': {
        if (arg === 'on' || arg === 'off' || arg === 'auto') {
          rt.darkOverride = arg === 'auto' ? null : arg
          await $.store.set(STORE_DARK_OVERRIDE, rt.darkOverride)
          await evaluateDark($)
        }
        const why = `context ${Math.round(rt.ctx)}% (threshold ${settings.darkThreshold}), ${rt.errorStreak} errors in a row`
        return { text: `Dark Sakura: ${rt.isDark ? 'yes' : 'no'} · override ${rt.darkOverride ?? 'auto'} · ${why}` }
      }
      case 'say':
      {
        const time = localTime(await $.clock.now(), settings.timezone)
        const line = rt.mood === 'idle' ? idleLine(time, rt.isDark) : sakuraLine(rt.mood, rt.isDark)
        await say($, line)
      }
        return {}
      case 'sleep':
        await setMood($, 'sleeping')
        return {}
      case 'bond': {
        const rows = Object.values(CAST).map(entry => `${entry.name.padEnd(14)} ${bond[entry.id] ?? 0} turns`)
        return { text: rows.join('\n') }
      }
      default:
        return { text: USAGE }
    }
  })
}
