// Who answers which summons: subagent type -> character, with understudies and badges.
import type { HeavensFeelAgent, HeavensFeelCharacter, HeavensFeelMood } from '../types'

type Character = HeavensFeelCharacter

const EXACT: Readonly<Record<string, Character>> = {
  explore: 'rider',
  plan: 'rin',
  'general-purpose': 'shirou',
  claude: 'shirou',
  teammate: 'shirou',
  'claude-code-guide': 'kirei',
  'statusline-setup': 'taiga',
  fork: 'sakura',
}

const RULES: readonly (readonly [RegExp, Character])[] = [
  [/review|checker|audit|lint|coderabbit/, 'archer'],
  [/judge|verif|meta|proximity/, 'saber-alter'],
  [/research|explor|map|search|scout|discover|intel|profil|classif/, 'rider'],
  [/plan|roadmap|synth|architect|spec/, 'rin'],
  [/debug|forensic|fixer|hunt|security/, 'true-assassin'],
  [/gener|evolv|ideat|sketch|spike|empiric/, 'illya'],
  [/exec|writ|build|updat|experiment|doc-|codebase-mapper/, 'shirou'],
  [/guide|docs|help|explain/, 'kirei'],
  [/fast|quick|autonom|berserk/, 'berserker'],
]

const POOL: readonly Character[] = [
  'archer',
  'saber-alter',
  'illya',
  'true-assassin',
  'berserker',
  'rider',
  'rin',
  'shirou',
]

const UNDERSTUDIES: Readonly<Record<Character, readonly Character[]>> = {
  sakura: [],
  rider: ['true-assassin', 'illya'],
  rin: ['archer', 'saber-alter'],
  shirou: ['berserker', 'archer'],
  kirei: ['saber-alter', 'archer'],
  taiga: ['illya', 'shirou'],
  archer: ['saber-alter', 'rin'],
  'saber-alter': ['archer', 'berserker'],
  illya: ['rider', 'berserker'],
  'true-assassin': ['rider', 'saber-alter'],
  berserker: ['shirou', 'true-assassin'],
}

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export const characterForType = (subagentType: string): Character => {
  const type = subagentType.toLowerCase().replace(/^[^:]+:/, '')
  const exact = EXACT[type]
  if (exact) return exact
  const rule = RULES.find(([pattern]) => pattern.test(type))
  if (rule) return rule[1]
  return POOL[fnv1a(type) % POOL.length]!
}

export type Casting = { character: Character; badge: number }

/** The preferred character, else an understudy, else a free one, else the preferred with a badge. */
export const cast = (subagentType: string, running: readonly HeavensFeelAgent[]): Casting => {
  const preferred = characterForType(subagentType)
  if (preferred === 'sakura') return { character: 'sakura', badge: 1 }
  const busy = new Set(running.map(agent => agent.character))
  const free = [preferred, ...UNDERSTUDIES[preferred], ...POOL].find(one => !busy.has(one))
  if (free) return { character: free, badge: 1 }
  const sameCharacter = running.filter(agent => agent.character === preferred)
  return { character: preferred, badge: sameCharacter.length + 1 }
}

const EDITING = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SEARCHING = new Set(['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'ToolSearch', 'LSP'])

export const moodForTool = (tool: string): HeavensFeelMood => {
  if (EDITING.has(tool)) return 'editing'
  if (SEARCHING.has(tool)) return 'searching'
  if (tool === 'Agent' || tool === 'Task') return 'summoning'
  return 'running'
}

const NUMERALS = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X']

export const badgeSuffix = (badge: number): string => NUMERALS[badge] ?? ` ${badge}`
