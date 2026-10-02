// Which frame shows now: mood + clock -> named overlay parts -> a cached pixel grid.
import type { HeavensFeelCharacter, HeavensFeelMood } from '../types'
import { compose, crop, paint, shift, type Grid } from './render'
import { HD_EXPRESSION_COLORS, HD_POSE_COLORS, SAKURA_HD_EXPRESSION_ROWS, SAKURA_HD_POSES, type HdExpression, type HdPose } from './sprites.generated'
import { CAST, DARK_SAKURA_MINI, SAKURA_HD, SAKURA_PORTRAIT, type Overlay, type Palette, type Sprite } from './sprites'

export type PortraitSize = 'hd' | 'sd'

export type Scene = {
  mood: HeavensFeelMood
  isDark: boolean
  now: number
  isTalking: boolean
  /** Desktop idle animates inside the Svg (SMIL), so its frame leaves blink and bob out. */
  isSmil: boolean
}

export type Frame = { key: string; grid: Grid }

const BLINK_MS = 140
const MINI_BLINK_MS = 160
const BOB_MS = 1200
const PAD = 1

const BLINKING_MOODS = new Set<HeavensFeelMood>(['idle', 'thinking', 'editing', 'searching', 'running', 'summoning', 'interrupted'])
const OWN_MOUTH_MOODS = new Set<HeavensFeelMood>(['sleeping', 'ouch', 'done'])

const TALK_FLAP_MS = 220

const phase = (now: number, periodMs: number, frames: number): number => Math.floor(now / periodMs) % frames

/** The mouth flaps open and shut while a new line is being said. */
export const isTalkingAt = (now: number, talkUntil: number): boolean => now < talkUntil && phase(now, TALK_FLAP_MS, 2) === 0

type Blink = { next: number; until: number }
const blinks = new Map<string, Blink>()

/** Random blinks, 2.5 to 5.5 s apart (minis 3 to 6 s), each a beat long. */
export const isBlinking = (id: string, now: number, isMini = false): boolean => {
  const blink = blinks.get(id) ?? { next: now + 1000, until: 0 }
  if (now >= blink.next) {
    blink.until = now + (isMini ? MINI_BLINK_MS : BLINK_MS)
    blink.next = now + (isMini ? 3000 : 2500) + Math.random() * 3000
  }
  blinks.set(id, blink)
  return now < blink.until
}

const pad = (grid: Grid): Grid => {
  const h = grid.h + 2 * PAD
  const px = new Int32Array(grid.w * h).fill(-1)
  px.set(grid.px, PAD * grid.w)
  return { w: grid.w, h, px }
}

const cache = new Map<string, Grid>()

const cached = (key: string, build: () => Grid): Frame => {
  const hit = cache.get(key)
  if (hit) return { key, grid: hit }
  const grid = build()
  cache.set(key, grid)
  return { key, grid }
}

// Standard portrait (24x32, hand drawn) ---------------------------------------

const P = SAKURA_PORTRAIT

const sdMoodParts = (mood: HeavensFeelMood, now: number): string[] => {
  switch (mood) {
    case 'thinking':
      return ['think', `thinkDots${phase(now, 450, 3)}`]
    case 'editing':
      return [`edit${phase(now, 320, 2)}`]
    case 'searching':
      return [`search${phase(now, 520, 2)}`]
    case 'running':
      return [`run${phase(now, 400, 2)}`]
    case 'summoning':
      return [`summon${phase(now, 260, 2)}`]
    case 'ouch':
      return ['ouch']
    case 'done':
      return ['happy']
    case 'sleeping':
      return ['sleep', `sleepZ${phase(now, 700, 3)}`]
    default:
      return []
  }
}

const SD_OVERLAYS: Readonly<Record<string, Overlay>> = {
  dark: P.darkOverlay,
  blink: P.blink,
  talk: P.talk,
  think: P.think,
  ouch: P.ouch,
  happy: P.happy,
  sleep: P.sleep,
  ...Object.fromEntries(P.thinkDots.map((o, i) => [`thinkDots${i}`, o])),
  ...Object.fromEntries(P.sleepZ.map((o, i) => [`sleepZ${i}`, o])),
  ...Object.fromEntries(P.edit.map((o, i) => [`edit${i}`, o])),
  ...Object.fromEntries(P.search.map((o, i) => [`search${i}`, o])),
  ...Object.fromEntries(P.run.map((o, i) => [`run${i}`, o])),
  ...Object.fromEntries(P.summon.map((o, i) => [`summon${i}`, o])),
}

// HD portrait (48x64, generated with Codex) ------------------------------------

const hdOverlay = (rows: readonly string[]): Overlay => ({ w: 48, h: 64, rows, palette: SAKURA_HD.base.palette })

const HD_OVERLAYS: Readonly<Record<string, Overlay>> = {
  blink: SAKURA_HD.blink,
  darkEyes: SAKURA_HD.darkEyes,
  ...Object.fromEntries(
    (Object.keys(SAKURA_HD_EXPRESSION_ROWS) as HdExpression[]).map(name => [name, hdOverlay(SAKURA_HD_EXPRESSION_ROWS[name])]),
  ),
}

/** In the dark form her magic burns crimson and the props darken. */
const HD_DARK_POSE_COLORS: Palette = { G: 0x8a6a2a, V: 0xd62a3a, W: 0xe7e2f1, C: 0xd62a3a }
const HD_PALETTE: Palette = { ...SAKURA_HD.base.palette, ...HD_EXPRESSION_COLORS, ...HD_POSE_COLORS }
const HD_DARK_PALETTE: Palette = { ...SAKURA_HD.darkPalette, ...HD_EXPRESSION_COLORS, ...HD_DARK_POSE_COLORS }

const SPARK = 0xf4f0ff
const DARK_SPARK = 0xd62a3a

type Point = readonly [number, number, number]

/** Small effects drawn in the empty top-right corner of the HD canvas. */
const hdEffect = (name: string, color: number): Point[] => {
  const dot = (x: number, y: number): Point[] => [[x, y, color], [x + 1, y, color]]
  switch (name) {
    case 'dots1':
      return dot(39, 6)
    case 'dots2':
      return [...dot(39, 6), ...dot(42, 4)]
    case 'dots3':
      return [...dot(39, 6), ...dot(42, 4), ...dot(45, 2)]
    case 'z0':
    case 'z1':
    case 'z2': {
      const y = 6 - Number(name[1]) * 2
      const x = 40 + Number(name[1]) * 2
      return [[x, y, color], [x + 1, y, color], [x + 2, y, color], [x + 1, y + 1, color], [x, y + 2, color], [x + 1, y + 2, color], [x + 2, y + 2, color]]
    }
    case 'spark0':
      return [[43, 3, color], [42, 4, color], [43, 4, color], [44, 4, color], [43, 5, color]]
    case 'spark1':
      return [[41, 2, color], [45, 2, color], [43, 4, color], [41, 6, color], [45, 6, color]]
    default:
      return []
  }
}

/** The whole-body pose each working mood takes, and how fast its frames turn over. */
const HD_POSES: Readonly<Partial<Record<HeavensFeelMood, { pose: HdPose; ms: number }>>> = {
  thinking: { pose: 'think', ms: 900 },
  editing: { pose: 'edit', ms: 300 },
  searching: { pose: 'search', ms: 450 },
  running: { pose: 'run', ms: 400 },
  summoning: { pose: 'summon', ms: 260 },
  done: { pose: 'done', ms: 500 },
  sleeping: { pose: 'sleep', ms: 2100 },
}

const OUCH_SHAKE_MS = 120

const poseSprite = (rows: readonly string[]): Sprite => ({ w: 48, h: 64, rows, palette: HD_PALETTE })

const hdEffectAt = (mood: HeavensFeelMood, now: number): string | undefined => {
  if (mood === 'thinking') return `dots${phase(now, 450, 3) + 1}`
  if (mood === 'sleeping') return `z${phase(now, 700, 3)}`
  return undefined
}

// Portrait frames ----------------------------------------------------------------

export const portraitFrame = (size: PortraitSize, scene: Scene): Frame => {
  const { mood, isDark, now, isTalking, isSmil } = scene
  const isBlink = !isSmil && BLINKING_MOODS.has(mood) && isBlinking('sakura', now)
  const bob = !isSmil && mood === 'idle' ? phase(now, BOB_MS, 2) : 0
  if (size === 'sd') {
    const moodParts = sdMoodParts(mood, now)
    const parts = [
      ...(isDark ? ['dark'] : []),
      ...moodParts,
      ...(isBlink ? ['blink'] : []),
      ...(isTalking && !OWN_MOUTH_MOODS.has(mood) && !isBlink ? ['talk'] : []),
    ]
    const key = `sd|${parts.join(',')}|${bob}`
    return cached(key, () => {
      const grid = compose(P.base, parts.map(part => SD_OVERLAYS[part]!), isDark ? P.darkPalette : P.base.palette)
      return shift(pad(grid), 0, bob)
    })
  }
  const palette = isDark ? HD_DARK_PALETTE : HD_PALETTE
  const effect = hdEffectAt(mood, now)
  const withEffect = (grid: Grid): Grid => (effect ? paint(grid, hdEffect(effect, isDark ? DARK_SPARK : SPARK)) : grid)
  const posed = HD_POSES[mood]
  if (posed) {
    const frames = SAKURA_HD_POSES[posed.pose]
    const index = phase(now, posed.ms, frames.length)
    const key = `hd|pose:${posed.pose}${index}|${effect ?? ''}|${isDark}`
    return cached(key, () => pad(withEffect(compose(poseSprite(frames[index]!), [], palette))))
  }
  const expression = mood === 'ouch' ? 'ouch' : isBlink ? 'blink' : isTalking ? 'talk' : undefined
  const hasOpenEyes = expression !== 'blink' && expression !== 'ouch'
  const parts = [...(expression ? [expression] : []), ...(isDark && hasOpenEyes ? ['darkEyes'] : [])]
  const shake = mood === 'ouch' ? phase(now, OUCH_SHAKE_MS, 2) * 2 - 1 : 0
  const key = `hd|${parts.join(',')}|${isDark}|${bob}|${shake}`
  return cached(key, () => {
    const grid = compose(SAKURA_HD.base, parts.map(part => HD_OVERLAYS[part]!), palette)
    return shift(pad(grid), shake, bob)
  })
}

/** The closed-eye frame the desktop Svg blinks to on its own. */
export const blinkFrame = (size: PortraitSize, isDark: boolean): Frame =>
  size === 'sd'
    ? cached(`sd-blink|${isDark}`, () => pad(compose(P.base, [...(isDark ? [P.darkOverlay] : []), P.blink], isDark ? P.darkPalette : P.base.palette)))
    : cached(`hd-blink|${isDark}`, () => pad(compose(SAKURA_HD.base, [SAKURA_HD.blink], isDark ? HD_DARK_PALETTE : HD_PALETTE)))

// Busts: head and shoulders, for the band ------------------------------------------

/** Pixel rows of the head-and-shoulders crop: 11 terminal rows standard, 20 HD. */
export const BUST_PIXEL_ROWS: Readonly<Record<PortraitSize, number>> = { sd: 22, hd: 40 }

const bustOf = (frame: Frame, size: PortraitSize): Frame =>
  cached(`bust|${frame.key}`, () => crop(frame.grid, BUST_PIXEL_ROWS[size]))

export const bustFrame = (size: PortraitSize, scene: Scene): Frame => bustOf(portraitFrame(size, scene), size)

export const bustBlinkFrame = (size: PortraitSize, isDark: boolean): Frame => bustOf(blinkFrame(size, isDark), size)

// Loops: the frames a mood cycles through, for surfaces that animate on their own --

type LoopSpec = Readonly<Partial<Record<HeavensFeelMood, { frames: number; ms: number }>>>

const SD_LOOPS: LoopSpec = {
  thinking: { frames: 3, ms: 450 },
  editing: { frames: 2, ms: 320 },
  searching: { frames: 2, ms: 520 },
  running: { frames: 2, ms: 400 },
  summoning: { frames: 2, ms: 260 },
  sleeping: { frames: 3, ms: 700 },
}

/** HD steps are the common beat of the pose and its effect: thinking's 900 ms pose over 450 ms dots. */
const HD_LOOPS: LoopSpec = {
  thinking: { frames: 6, ms: 450 },
  editing: { frames: 2, ms: 300 },
  searching: { frames: 2, ms: 450 },
  running: { frames: 2, ms: 400 },
  summoning: { frames: 2, ms: 260 },
  done: { frames: 2, ms: 500 },
  sleeping: { frames: 6, ms: 700 },
  ouch: { frames: 2, ms: OUCH_SHAKE_MS },
}

export type Loop = { frames: readonly Frame[]; ms: number }

/** Every frame of the mood's cycle, sampled once per step (blink and bob left to the Svg). */
export const moodLoop = (size: PortraitSize, frameOf: (scene: Scene) => Frame, scene: Scene): Loop => {
  const spec = (size === 'hd' ? HD_LOOPS : SD_LOOPS)[scene.mood] ?? { frames: 1, ms: 400 }
  const frames = Array.from({ length: spec.frames }, (_, k) => frameOf({ ...scene, now: k * spec.ms + 1, isSmil: true }))
  return { frames, ms: spec.ms }
}

// Minis -------------------------------------------------------------------------

const WORKING = new Set<HeavensFeelMood>(['editing', 'searching', 'running', 'summoning'])

export type MiniScene = { id: string; character: HeavensFeelCharacter; mood: HeavensFeelMood; isDark: boolean; now: number }

export const miniFrame = ({ id, character, mood, isDark, now }: MiniScene): Frame => {
  const set = character === 'sakura' && isDark ? DARK_SAKURA_MINI : CAST[character].mini
  const isWork = (WORKING.has(mood) && phase(now, 350, 2) === 1) || mood === 'done'
  const name = isWork ? 'work' : mood !== 'sleeping' && isBlinking(id, now, true) ? 'blink' : 'base'
  const sprite: Sprite = set[name]
  return cached(`mini|${character}|${isDark && character === 'sakura'}|${name}`, () => compose(sprite, []))
}

export const restingMini = (character: HeavensFeelCharacter): Frame =>
  cached(`mini|${character}|false|base`, () => compose(CAST[character].mini.base, []))

const HEAD_PIXEL_ROWS = 10

/** Head and collar of a mini: the face a message wears. */
export const headFrame = (character: HeavensFeelCharacter, isDark: boolean): Frame => {
  const isDarkSakura = isDark && character === 'sakura'
  const sprite = isDarkSakura ? DARK_SAKURA_MINI.base : CAST[character].mini.base
  return cached(`head|${character}|${isDarkSakura}`, () => crop(compose(sprite, []), HEAD_PIXEL_ROWS))
}
