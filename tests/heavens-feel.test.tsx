import { expect, mock, test } from 'claude-code/testing'

import { moodLoop, portraitFrame } from '../hooks/anim'
import { cast, characterForType, moodForTool } from '../hooks/cast'
import { compose, gridToRaster, gridToSvg, toBase64 } from '../hooks/render'
import { CAST, checkSprites, SAKURA_HD } from '../hooks/sprites'
import { greeting, isRestWindow } from '../hooks/voice'

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
const SVG_LIMIT = 131072
const SCROLL = { offset: 0, bodyRows: 40 }

test('every sprite is consistent', async () => {
  const problems = checkSprites()

  expect(problems).toEqual([])
})

test('base64 matches the standard encoding', async () => {
  const bytes = new TextEncoder().encode('Sakura!')
  const expected = 'U2FrdXJhIQ=='

  expect(toBase64(bytes)).toBe(expected)
})

test('half-block rasters are sized one column per pixel and two pixels per row', async () => {
  const sd = portraitFrame('sd', { mood: 'idle', isDark: false, now: 0, isTalking: false, isSmil: false })
  const hd = portraitFrame('hd', { mood: 'thinking', isDark: true, now: 0, isTalking: false, isSmil: false })
  const expectedSd = { columns: 24, rows: 17 }
  const expectedHd = { columns: 48, rows: 33 }

  const sdRaster = gridToRaster(sd.grid, 1)
  const hdRaster = gridToRaster(hd.grid, 1)

  expect({ columns: sdRaster.columns, rows: sdRaster.rows }).toEqual(expectedSd)
  expect({ columns: hdRaster.columns, rows: hdRaster.rows }).toEqual(expectedHd)
})

test('svg portraits stay under the element limit', async () => {
  const grid = compose(SAKURA_HD.base, [])
  const blink = compose(SAKURA_HD.base, [SAKURA_HD.blink])

  const source = gridToSvg(grid, { pixel: 4, blink, isBreathing: true })

  expect(source.length < SVG_LIMIT).toBe(true)
})

test('subagent types map to their characters', async () => {
  const expected = {
    Explore: 'rider',
    Plan: 'caster',
    'general-purpose': 'saber',
    'claude-code-guide': 'gilgamesh',
    'statusline-setup': 'assassin',
    'coderabbit:code-reviewer': 'archer',
    'gsd-debugger': 'true-assassin',
  }

  const actual = Object.fromEntries(Object.keys(expected).map(type => [type, characterForType(type)]))

  expect(actual).toEqual(expected)
})

test('a busy character hands the summons to an understudy', async () => {
  const rider = { id: 'a', character: 'rider', badge: 1, type: 'Explore', description: '', isFork: false, mood: 'thinking', startedAt: 0, isError: false, line: '', activity: '', tools: 0 } as const
  const expected = { character: 'true-assassin', badge: 1 }

  expect(cast('Explore', [rider])).toEqual(expected)
})

test('tools map to moods', async () => {
  const expected = ['editing', 'searching', 'running', 'summoning']

  expect(['Edit', 'Grep', 'Bash', 'Agent'].map(moodForTool)).toEqual(expected)
})

test('no work greetings during Shabbat', async () => {
  const fridayNight = { hour: 21, weekday: 5 }
  const saturdayNight = { hour: 21, weekday: 6 }
  const expectedRest = 'Hello, Senpai.'
  const expectedMotzei = 'Shavua tov, Senpai. A fresh week.'

  expect(isRestWindow(fridayNight)).toBe(true)
  expect(greeting(fridayNight)).toBe(expectedRest)
  expect(greeting(saturdayNight)).toBe(expectedMotzei)
})

test('the cast is five Masters and ten Servants, and subagents only ever get Servants', async () => {
  const expectedMasters = 5
  const expectedServants = 10
  const types = ['Explore', 'Plan', 'general-purpose', 'claude', 'fork', 'gsd-planner', 'research:co-judge', 'anything-else', 'zz-unknown-type']

  const roles = Object.values(CAST).map(entry => entry.role)
  const castRoles = types.map(type => CAST[characterForType(type)].role)

  expect(roles.filter(role => role === 'master').length).toBe(expectedMasters)
  expect(roles.filter(role => role === 'servant').length).toBe(expectedServants)
  expect(castRoles.every(role => role === 'servant')).toBe(true)
})

test('the pane draws on every surface without a refusal', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 1, 9) })
  for (const surface of SURFACES) {
    for (const [placement, bodyColumns] of [['dock', 52], ['inline', 30]] as const) {
      const ui = await $.ui.mount({
        plugin: 'heavens-feel',
        surface,
        component: 'Pane',
        requestId: 'hf',
        viewport: { columns: 160, rows: 50, isFullscreen: placement === 'dock' },
        props: { title: "Sakura's room", isFocused: false, bodyColumns, placement, scroll: SCROLL, view: {} },
      })

      const name = await ui.find({ type: 'Text', text: /Sakura Matou/ })
      const portrait = await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })

      expect(name).toBeDefined()
      expect(portrait).toBeDefined()
      await ui.unmount()
    }
  }
})

test('the cast roster draws on every surface', async $ => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: 'heavens-feel',
      surface,
      component: 'CommandOutput',
      props: { command: 'hf', args: 'cast', text: "✿ The cast of Heaven's Feel\n...", isErrored: false },
    })

    const rin = await ui.find({ type: 'Text', text: /Rin Tohsaka/ })

    expect(rin).toBeDefined()
    await ui.unmount()
  }
})

const band = (maxRows: number, bodyColumns: number) => ({
  plugin: 'heavens-feel',
  component: 'AbovePrompt' as const,
  requestId: 'band',
  viewport: { columns: bodyColumns + 2, rows: 50, isFullscreen: false },
  props: { hasSurvey: false, isWorking: false, maxRows, bodyColumns, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
})

test('the band shows her portrait where it has room, and a single line where it does not', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 1, 9) })
  const cases = [
    { surface: 'terminal', maxRows: 24, bodyColumns: 120, expected: 'Raster' },
    { surface: 'terminal', maxRows: 14, bodyColumns: 70, expected: 'Raster' },
    { surface: 'terminal', maxRows: 6, bodyColumns: 70, expected: undefined },
    { surface: 'desktop', maxRows: 14, bodyColumns: 70, expected: 'Svg' },
  ] as const

  for (const { surface, maxRows, bodyColumns, expected } of cases) {
    const ui = await $.ui.mount({ surface, ...band(maxRows, bodyColumns) })
    const portrait = (await ui.find({ type: 'Raster' })) ?? (await ui.find({ type: 'Svg' }))
    const name = await ui.find({ type: 'Text', text: /Sakura/ })

    expect(portrait?.type).toBe(expected)
    expect(name).toBeDefined()
    await ui.unmount()
  }
})

/** What the engine would answer the calls heavens-feel makes when a session starts. */
const answerSessionStart = (on: any) => {
  on('session.start', async (_$: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: { command: 'hf' } }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200000, percent: 42 }, rateLimits: [] } }))
  on('session.surfaces', async () => ({ value: ['terminal'] }))
  on('config.list', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
}

const PANE_PROPS = { title: "Sakura's room", isFocused: false, bodyColumns: 52, placement: 'dock', scroll: SCROLL, view: {} } as const

test('a summoned subagent shows in the pane as its character, doing what it does', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 1, 9) })
  mock.store(on)
  answerSessionStart(on)
  on('agent.spawn', async () => ({ model: 'claude-sonnet-5-5', agentId: 'agent-1' }))
  on('tool.call', async () => ({ result: 'ok' }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const spawn = {
    tool_use_id: 'tu-1', prompt: 'find it', description: 'find the auth flow', subagentType: 'Explore',
    provider: { kind: 'engine' }, parentModel: 'claude-opus-5-5', background: true, fork: false,
  }
  const expectedActivity = /searching for "redirect"/

  await $.agent.spawn(spawn as never)
  await $.tool.call({ tool: 'Grep', pattern: 'redirect', agentId: 'agent-1' } as never)
  const ui = await $.ui.mount({ plugin: 'heavens-feel', surface: 'terminal', component: 'Pane', requestId: 'hf', props: PANE_PROPS })
  const rider = await ui.find({ type: 'Text', text: /Rider/ })
  const activity = await ui.find({ type: 'Text', text: expectedActivity })
  const allegiance = await ui.find({ type: 'Text', text: /Servant of Sakura/ })

  expect(rider).toBeDefined()
  expect(activity).toBeDefined()
  expect(allegiance).toBeDefined()
  await ui.unmount()
})

test("pressing a Servant's card opens its own conversation, and back returns to Sakura", async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 1, 9) })
  mock.store(on)
  answerSessionStart(on)
  on('agent.spawn', async () => ({ model: 'claude-sonnet-5-5', agentId: 'agent-7' }))
  const reply = 'The redirect lives in auth/session.ts.'
  on('session.messages', async () => ({
    value: [
      { role: 'user', text: 'Find where the login redirect happens.', toolUses: [] },
      { role: 'assistant', text: reply, toolUses: [{ tool_use_id: 'u1', tool: 'Grep', input: { pattern: 'redirect' }, text: '3 files' }] },
    ],
  }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  const spawn = {
    tool_use_id: 'tu-7', prompt: 'find it', description: 'find the login redirect', subagentType: 'Explore',
    provider: { kind: 'engine' }, parentModel: 'claude-opus-5-5', background: true, fork: false,
  }
  await $.agent.spawn(spawn as never)
  const ui = await $.ui.mount({ plugin: 'heavens-feel', surface: 'terminal', component: 'Pane', requestId: 'hf', props: PANE_PROPS })

  await ui.press({ key: 'view-agent-7' })
  const report = await ui.find({ type: 'Text', text: /report/ })
  const grep = await ui.find({ type: 'Text', text: /searching for "redirect"/ })
  await ui.press({ key: 'back' })
  const sakura = await ui.find({ type: 'Text', text: /Sakura Matou/ })

  expect(report).toBeDefined()
  expect(grep).toBeDefined()
  expect(sakura).toBeDefined()
  await ui.unmount()
})

test("a reply wears its author's face on every surface", async ($, on) => {
  const replyText = 'I traced the redirect.'
  on('ui.render', { component: 'AssistantMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e) as any
    return <Text>{replyText}</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'heavens-feel', surface, component: 'AssistantMessage', requestId: 'msg-1',
      props: { text: replyText, isFirstOfReply: true },
    })
    const face = (await ui.find({ type: 'Raster' })) ?? (await ui.find({ type: 'Svg' }))
    const name = await ui.find({ type: 'Text', text: /Sakura/ })
    const reply = await ui.find({ type: 'Text', text: replyText })

    expect(face).toBeDefined()
    expect(name).toBeDefined()
    expect(reply).toBeDefined()
    await ui.unmount()
  }
})

test('every animated portrait fits the svg limit', async () => {
  const moods = ['idle', 'thinking', 'editing', 'searching', 'running', 'summoning', 'ouch', 'done', 'sleeping'] as const

  const sizes = moods.flatMap(mood =>
    [false, true].map(isDark => {
      const loop = moodLoop('hd', scene => portraitFrame('hd', scene), { mood, isDark, now: 0, isTalking: false, isSmil: true })
      const [first, ...rest] = loop.frames
      return gridToSvg(first!.grid, { pixel: 4, frames: rest.map(one => one.grid), frameMs: loop.ms, backdrop: { theme: 'auto', accent: 0x8f73c2 } }).length
    }),
  )

  expect(Math.max(...sizes) < SVG_LIMIT).toBe(true)
})

/** Box props Claude Code refuses on any ancestor of a node it draws itself. */
const ENGINE_ANCESTOR_BANNED = ['display', 'overflow', 'position', 'width', 'height', 'minWidth', 'minHeight', 'top', 'left', 'right', 'bottom']

/** The banned Box props on the way down to the first node whose text matches. */
const bannedAbove = (node: any, text: string, banned: string[] = []): string[] | undefined => {
  if (typeof node === 'string') return node.includes(text) ? banned : undefined
  const here = node?.type === 'Box' ? ENGINE_ANCESTOR_BANNED.filter(prop => node.props?.[prop] !== undefined) : []
  for (const child of node?.children ?? []) {
    const found = bannedAbove(child, text, [...banned, ...here])
    if (found) return found
  }
  return undefined
}

test('the avatar wraps the message without a prop the engine refuses above its own drawing', async ($, on) => {
  const replyText = 'The engine draws this reply.'
  const expected: string[] = []
  on('ui.render', { component: 'AssistantMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e) as any
    return <Text>{replyText}</Text>
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'heavens-feel', surface, component: 'AssistantMessage', requestId: 'm-guard',
      props: { text: replyText, isFirstOfReply: true },
    })
    const banned = bannedAbove(await ui.drawn(), replyText)

    expect(banned).toEqual(expected)
    await ui.unmount()
  }
})
