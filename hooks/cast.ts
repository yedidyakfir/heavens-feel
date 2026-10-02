// Who answers which summons: subagent type -> character, with understudies and badges.
import type { HeavensFeelAgent, HeavensFeelMood, HeavensFeelServant } from '../types'

type Servant = HeavensFeelServant

/** Built-in subagent types: each answered by the Servant whose legend fits the job. */
const EXACT: Readonly<Record<string, Servant>> = {
  explore: 'rider',
  plan: 'caster',
  'general-purpose': 'saber',
  claude: 'saber',
  teammate: 'saber',
  'claude-code-guide': 'gilgamesh',
  'statusline-setup': 'assassin',
  fork: 'rider',
}

/** Custom types by name, first match wins. */
const RULES: readonly (readonly [RegExp, Servant])[] = [
  [/review|checker|audit|lint|coderabbit/, 'archer'],
  [/judge|verif|meta|proximity/, 'saber-alter'],
  [/research|explor|map|search|scout|discover|intel|profil|classif/, 'rider'],
  [/plan|roadmap|synth|architect|spec/, 'caster'],
  [/debug|forensic|fixer|hunt|security/, 'true-assassin'],
  [/gener|evolv|ideat|sketch|spike|empiric/, 'lancer'],
  [/exec|writ|build|updat|experiment|doc-|codebase-mapper/, 'saber'],
  [/guide|docs|help|explain/, 'gilgamesh'],
  [/fast|quick|autonom|berserk/, 'berserker'],
  [/style|format|status|ui|design/, 'assassin'],
]

/** Every Servant in summoning order: the fallback for a type no rule names. */
const POOL: readonly Servant[] = [
  'archer',
  'saber-alter',
  'lancer',
  'true-assassin',
  'berserker',
  'rider',
  'caster',
  'saber',
  'assassin',
  'gilgamesh',
]

/** Who steps in when a Servant is already out on another summons. */
const UNDERSTUDIES: Readonly<Record<Servant, readonly Servant[]>> = {
  rider: ['true-assassin', 'lancer'],
  saber: ['saber-alter', 'lancer'],
  'saber-alter': ['saber', 'berserker'],
  archer: ['gilgamesh', 'saber-alter'],
  lancer: ['rider', 'assassin'],
  caster: ['archer', 'gilgamesh'],
  assassin: ['lancer', 'caster'],
  'true-assassin': ['rider', 'assassin'],
  berserker: ['saber-alter', 'lancer'],
  gilgamesh: ['archer', 'caster'],
}

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export const characterForType = (subagentType: string): Servant => {
  const type = subagentType.toLowerCase().replace(/^[^:]+:/, '')
  const exact = EXACT[type]
  if (exact) return exact
  const rule = RULES.find(([pattern]) => pattern.test(type))
  if (rule) return rule[1]
  return POOL[fnv1a(type) % POOL.length]!
}

export type Casting = { character: Servant; badge: number }

/** The preferred Servant, else an understudy, else a free one, else the preferred with a badge. */
export const cast = (subagentType: string, running: readonly HeavensFeelAgent[]): Casting => {
  const preferred = characterForType(subagentType)
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
