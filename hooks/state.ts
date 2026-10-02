// Settings and the module's own runtime state. The atoms live in register.tsx, where $ reads them.
import type { PluginOptions } from 'claude-code'

import type { HeavensFeelAgent, HeavensFeelMood } from '../types'
import type { Frame } from './anim'

export const PANE = 'hf'

export type Settings = {
  paneOnStart: boolean
  band: 'auto' | 'always' | 'never'
  spinnerTakeover: 'off' | 'word'
  darkThreshold: number
  sleepAfterMinutes: number
  timezone: string
}

export const readSettings = (options: PluginOptions): Settings => ({
  paneOnStart: options.paneOnStart !== false,
  band: options.band === 'always' || options.band === 'never' ? options.band : 'auto',
  spinnerTakeover: options.spinnerTakeover === 'off' ? 'off' : 'word',
  darkThreshold: typeof options.darkThreshold === 'number' ? options.darkThreshold : 75,
  sleepAfterMinutes: typeof options.sleepAfterMinutes === 'number' ? options.sleepAfterMinutes : 5,
  timezone: typeof options.timezone === 'string' && options.timezone ? options.timezone : 'Asia/Jerusalem',
})

export type DarkOverride = 'on' | 'off' | null

/** A Raster the tick keeps animating; `frameAt` answers null once its subject is gone. */
export type LiveRaster = { requestId: string; scale: 1 | 2; frameAt: (now: number) => Frame | null }

/** Module memory: mirrors of the atoms the 10 Hz tick reads, plus what the terminal has mounted. */
export const rt = {
  canDraw: false,
  surfaces: [] as readonly string[],
  mood: 'idle' as HeavensFeelMood,
  isDark: false,
  isDarkByAuto: false,
  darkOverride: null as DarkOverride,
  ctx: 0,
  errorStreak: 0,
  isTurnRunning: false,
  lastActivity: 0,
  talkUntil: 0,
  moodToken: 0,
  lastLineAt: 0,
  agents: {} as Record<string, HeavensFeelAgent>,
  /** Every Raster on screen, by key: where it is drawn and how to draw it at a given time. */
  rasters: new Map<string, LiveRaster>(),
  /** Assistant row id -> the subagent that wrote it (absent: the main session). */
  messageAgents: new Map<string, string>(),
  /** Agents that finished and left the roster, still needed to draw their messages. */
  pastAgents: new Map<string, HeavensFeelAgent>(),
  /** The frame each Raster last showed, so the tick blits only when it changes. */
  blitted: new Map<string, string>(),
}
