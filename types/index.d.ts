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

export type HeavensFeelCharacter =
  | 'sakura'
  | 'rider'
  | 'rin'
  | 'shirou'
  | 'kirei'
  | 'taiga'
  | 'archer'
  | 'saber-alter'
  | 'illya'
  | 'true-assassin'
  | 'berserker'

export type HeavensFeelAgent = {
  id: string
  character: HeavensFeelCharacter
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
    }
  }
}
