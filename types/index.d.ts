export type HeavensFeelMood =
  | 'idle'
  | 'thinking'
  | 'editing'
  | 'searching'
  | 'running'
  | 'summoning'
  | 'ouch'
  | 'done'
  | 'sleeping'
  | 'interrupted'

/** The Masters of the Heaven's Feel war: the main session is one of them. */
export type HeavensFeelMaster = 'sakura' | 'shirou' | 'rin' | 'illya' | 'kirei'

/** The Servants: every subagent is summoned as one of them. */
export type HeavensFeelServant =
  | 'rider'
  | 'saber'
  | 'saber-alter'
  | 'archer'
  | 'lancer'
  | 'caster'
  | 'assassin'
  | 'true-assassin'
  | 'berserker'
  | 'gilgamesh'

export type HeavensFeelCharacter = HeavensFeelMaster | HeavensFeelServant

export type HeavensFeelAgent = {
  id: string
  character: HeavensFeelServant
  badge: number
  type: string
  description: string
  isFork: boolean
  mood: HeavensFeelMood
  startedAt: number
  endedAt?: number
  isError: boolean
  line: string
  /** What it is doing right now, e.g. "reading register.tsx". */
  activity: string
  tools: number
}

/** What Sakura is doing right now, shown under her name. */
export type HeavensFeelActivity = { icon: string; text: string; at: number }

export type HeavensFeelTheme = 'light' | 'dark' | 'auto'

export type HeavensFeelBubble = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'heavens-feel': {
      mood: HeavensFeelMood
      dark: boolean
      ctx: number
      agents: Record<string, HeavensFeelAgent>
      bubble: HeavensFeelBubble
      paneVisible: boolean
      activity: HeavensFeelActivity
      theme: HeavensFeelTheme
      /** The subagent Sakura's room is showing, '' for her own view. */
      viewing: string
    }
  }
}
