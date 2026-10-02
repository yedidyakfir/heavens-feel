// Every line the cast says: static tables, zero tokens. All lines are original.
import type { HeavensFeelCharacter, HeavensFeelMood } from '../types'

type Lines = Partial<Record<HeavensFeelMood | 'wake' | 'enter' | 'exit', readonly string[]>>

export const SAKURA: Lines = {
  idle: [
    "I'll be right here, Senpai. Take your time.",
    "The kettle's on. Figuratively.",
    "No rush. The code isn't going anywhere.",
    'Should I start on something while you think?',
    "It's quiet. I like quiet.",
  ],
  thinking: [
    'Let me think this through properly...',
    "Hm. There's a cleaner way to do this, I'm sure of it.",
    "One moment, I'm following the thread.",
    'I want to get this right the first time.',
    'Reading between the lines...',
  ],
  editing: [
    'Careful stitches. One line at a time.',
    'Just a small change here. And here.',
    "I'll leave it tidier than I found it.",
    "Writing... please don't look over my shoulder yet.",
    'Almost. Let me fix the indentation too.',
  ],
  searching: [
    'Where did you put it, Senpai...',
    'Looking through the files. Every cupboard.',
    "I know it's in here somewhere.",
    'grep is patient, and so am I.',
    'Following the imports down the hall.',
  ],
  running: [
    "Running it. Fingers crossed.",
    'Please work, please work, please work.',
    'The terminal is thinking. So am I.',
    "If this takes long, I'll make tea.",
    "Let's see what the machine says.",
  ],
  summoning: [
    "I'll ask for help with this one.",
    "Calling someone who's better at this than me.",
    'Please, lend me your strength for a moment.',
    "A Servant answers. I'll coordinate.",
  ],
  ouch: [
    "Ah... that's not what I meant to happen.",
    "I'm sorry. Let me look at what went wrong.",
    'It bit me. Just a little.',
    'A failing test is still information. Right?',
    'Okay. Okay. Deep breath. Again.',
  ],
  done: [
    "Done, Senpai. I hope it's to your liking.",
    'There. All finished and put away.',
    'I did it. Did you see?',
    'That went well. Shall we keep going?',
    "Finished. I'm a little proud of this one.",
  ],
  interrupted: ['Oh. Stopping, then.', "Understood. I'll put it down.", "Changed your mind? That's alright."],
  sleeping: [
    'zzz... the rice is... almost...',
    '...Senpai... five more minutes...',
    '(she has nodded off at the desk)',
    "mm... don't forget to commit...",
  ],
  wake: ['Welcome back, Senpai. I kept your place.', "Oh! I wasn't asleep. I was... resting my eyes."],
}

export const DARK_SAKURA: Lines = {
  enter: [
    "...Senpai? Something's wrong with— no. No, it's fine. I'm fine.",
    "It's getting crowded in here. So many things to remember.",
  ],
  exit: ["...I'm back. I'm sorry you had to see that.", 'The shadows went quiet. Thank you for waiting.'],
  idle: [
    "I'm not going anywhere. Neither are you.",
    'The shadows are comfortable. Join me.',
    "It feels late, doesn't it. It always feels late.",
    "Everything's fine. I'm fine. Really.",
  ],
  thinking: [
    'I can see every branch of this. All of them end.',
    "Quiet. I'm concentrating.",
    "There's a faster way. You won't like it.",
    'Thinking is easy now. Stopping is the hard part.',
  ],
  editing: [
    "I'll rewrite this. All of it, if I have to.",
    'A few lines fewer. Nobody will miss them.',
    "Hold still. This won't hurt the code much.",
    'Changing things is the easy part.',
  ],
  searching: [
    'Nothing hides from me anymore.',
    "I've read this file already. I'm reading it again to be sure.",
    'There you are.',
    'Every cupboard, every drawer, every closet.',
  ],
  running: ["Run. Let's see how far it gets.", "If it fails, I'll make it stop failing.", 'The machine does what I say now.'],
  summoning: ['Come. I have work for you.', 'Another one answers. Good.', "You'll do what I need. You always do."],
  ouch: ["...Don't look at me like that.", "That wasn't my fault. It wasn't.", 'Fine. FINE. Again.', 'Something broke. Something always breaks.'],
  done: ['There. Was that so hard?', 'Finished. You may thank me.', "It's done. I didn't even have to try.", 'Good. Now the next thing.'],
  interrupted: ['...You stopped me. Interesting.', 'As you wish. For now.'],
  sleeping: ['...not asleep. Resting my eyes.', 'zzz... (even the shadows are still)'],
  wake: ['...You came back. Of course you did.'],
}

type ServantLines = { spawn: readonly string[]; working: readonly string[]; done: readonly string[]; error: readonly string[] }

export const SERVANTS: Readonly<Record<HeavensFeelCharacter, ServantLines>> = {
  sakura: {
    spawn: ["I'll take this part myself. A copy of me, anyway."],
    working: ['Same kitchen, second pair of hands.'],
    done: ['The other me is finished.'],
    error: ['Even my copy trips sometimes.'],
  },
  rider: {
    spawn: ["I'll go ahead and look. Stay here.", "Scouting. I won't be long."],
    working: ['Nothing in this corridor. Next.', 'I see it. Mapping the rest.', 'Faster if nobody follows me.'],
    done: ["Here's what's out there. All of it.", 'Reconnaissance complete. Nothing escaped me.'],
    error: ["...Blocked. I'll find another way in.", "That path's a dead end."],
  },
  rin: {
    spawn: ["Fine. I'll make a plan. A proper one.", 'Step back; this needs a strategist.'],
    working: ['Order matters here. Let me sequence it.', 'If we do it in this order, nothing breaks. Probably.', "Don't rush me. Rushing is how you get Shirou."],
    done: ["Here's the plan. Follow it exactly.", "Plan's ready. Don't make me regret the detail."],
    error: ["That... wasn't in the plan. Give me a second.", 'Ugh. An unknown. Adjusting.'],
  },
  shirou: {
    spawn: ["Leave it to me. I'll get it done.", "On it. I don't quit halfway."],
    working: ['Trace, on... okay, more like "type, on".', 'Rolling up my sleeves.', 'One more pass. Just one.'],
    done: ['Done! Rough edges, but it works.', 'Finished. Took a few tries, but it holds.'],
    error: ["Ow. Okay, that didn't take. Again.", 'I broke it. I can fix it.'],
  },
  kirei: {
    spawn: ['Ask, and I shall explain the rules of this war. The tool, I mean.', 'A question of doctrine. How delightful.'],
    working: ['Consulting the scripture. The documentation, that is.', 'Everything has a rule. Let me find yours.'],
    done: ['There is your answer. Use it wisely, or not; both amuse me.', 'Explained. The rest is your choice.'],
    error: ['The texts are silent on this. Rare.', 'Even I cannot find that. Curious.'],
  },
  taiga: {
    spawn: ["Tiger Dojo is OPEN! Status line lesson, let's go!", 'Leave the setup to your homeroom teacher!'],
    working: ["Pay attention, this part's on the test.", 'A little to the left... there.'],
    done: ['Lesson over! Your status line looks great, student!', 'Dojo dismissed. Go show it off.'],
    error: ["Eh?! That's not how the diagram goes.", 'Okay, nobody saw that. Again.'],
  },
  archer: {
    spawn: ["Let's see what you've written. Try not to disappoint me.", "A review. I'll be honest; you won't enjoy it."],
    working: ['This function does three things. Pick one.', 'Interesting choice. Not a good one.'],
    done: ['Review complete. Fewer problems than I expected. Slightly.', 'There. Fix those and it might survive production.'],
    error: ["I can't review what I can't read.", 'The tools failed before I could judge you. Lucky.'],
  },
  'saber-alter': {
    spawn: ['Present the evidence. I will judge it.', 'A verdict is required. Stand aside.'],
    working: ['Weighing. Do not interrupt.', 'This claim is unsupported. Noted.'],
    done: ['Verdict delivered. It is final.', 'Judged. The result stands.'],
    error: ['Insufficient. I cannot rule on this.', 'The evidence is corrupted. Unacceptable.'],
  },
  illya: {
    spawn: ['Ooh, a new idea? Let me play with it!', "Illya's turn! Nobody interrupt."],
    working: ['What if we did the opposite? No, wait, THIS!', "Hehe. This one's fun."],
    done: ['Ta-da! Lots of ideas. Some of them are even good.', 'Done! Pick your favourite.'],
    error: ["Boo. It broke. That's boring.", "Hmph. Try again, I wasn't ready."],
  },
  'true-assassin': {
    spawn: ['...I will find it.', 'A target. Good.'],
    working: ['Closer.', 'It leaves traces. They all do.'],
    done: ['Found. It will not trouble you again.', 'The bug is dead. Nothing else was touched.'],
    error: ['...It slipped away. For now.', 'Hm. A false trail.'],
  },
  berserker: {
    spawn: ['▮▮▮▮!', '(a low growl; he has started)'],
    working: ['▮▮▮...', '(the ground shakes a little)'],
    done: ['▮!', '(it is done; he lowers the blade)'],
    error: ['▮▮▮▮▮!!', '(the blade hits stone; he tries again)'],
  },
}

type VerbMood = 'thinking' | 'editing' | 'searching' | 'running' | 'summoning'

const SAKURA_VERBS: Readonly<Record<VerbMood, string>> = {
  thinking: 'pondering',
  editing: 'stitching',
  searching: 'looking',
  running: 'waiting on the shell',
  summoning: 'calling',
}

const DARK_VERBS: Readonly<Record<VerbMood, string>> = {
  thinking: 'scheming',
  editing: 'rewriting',
  searching: 'finding',
  running: 'commanding',
  summoning: 'summoning',
}

const SERVANT_VERBS: Readonly<Record<HeavensFeelCharacter, readonly [string, string, string]>> = {
  sakura: ['pondering', 'stitching', 'looking'],
  rider: ['scouting', 'reading', 'mapping'],
  rin: ['planning', 'sequencing', 'calculating'],
  shirou: ['working', 'tracing', 'hammering'],
  kirei: ['consulting', 'explaining', 'consulting'],
  taiga: ['teaching', 'adjusting', 'teaching'],
  archer: ['reviewing', 'judging your choices', 'reviewing'],
  'saber-alter': ['weighing', 'ruling', 'weighing'],
  illya: ['playing', 'scheming', 'playing'],
  'true-assassin': ['hunting', 'closing in', 'hunting'],
  berserker: ['smashing', 'roaring', 'smashing'],
}

const isVerbMood = (mood: HeavensFeelMood): mood is VerbMood => mood in SAKURA_VERBS

export const sakuraVerb = (mood: HeavensFeelMood, isDark: boolean): string =>
  isVerbMood(mood) ? (isDark ? DARK_VERBS : SAKURA_VERBS)[mood] : isDark ? 'scheming' : 'pondering'

export const servantVerb = (character: HeavensFeelCharacter, mood: HeavensFeelMood): string => {
  const [thinking, editing, searching] = SERVANT_VERBS[character]
  if (mood === 'editing' || mood === 'running') return editing
  if (mood === 'searching') return searching
  return thinking
}

const recent = new Map<string, string[]>()

/** A line from the table, avoiding the last two picked for the same table. */
export const pick = (key: string, lines: readonly string[] | undefined): string => {
  if (!lines || lines.length === 0) return ''
  const last = recent.get(key) ?? []
  const fresh = lines.filter(line => !last.includes(line))
  const pool = fresh.length > 0 ? fresh : lines
  const line = pool[Math.floor(Math.random() * pool.length)]!
  recent.set(key, [...last, line].slice(-2))
  return line
}

export const sakuraLine = (mood: HeavensFeelMood | 'wake' | 'enter' | 'exit', isDark: boolean): string => {
  const table = isDark ? DARK_SAKURA : SAKURA
  return pick(`${isDark ? 'dark' : 'sakura'}:${mood}`, table[mood] ?? SAKURA[mood as HeavensFeelMood])
}

export const servantLine = (character: HeavensFeelCharacter, kind: keyof ServantLines): string =>
  pick(`${character}:${kind}`, SERVANTS[character][kind])

// Greetings ------------------------------------------------------------------

export type LocalTime = { hour: number; minute?: number; weekday: number }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const formatters = new Map<string, Intl.DateTimeFormat | null>()

/** One formatter per zone; null where the environment has no Intl or does not know the zone. */
const formatterFor = (timeZone: string): Intl.DateTimeFormat | null => {
  if (!formatters.has(timeZone)) {
    try {
      const options = { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short' } as const
      formatters.set(timeZone, new Intl.DateTimeFormat('en-US', options))
    } catch {
      formatters.set(timeZone, null)
    }
  }
  return formatters.get(timeZone) ?? null
}

export const localTime = (now: number, timeZone: string): LocalTime => {
  const formatter = formatterFor(timeZone)
  if (!formatter) {
    const date = new Date(now)
    return { hour: date.getHours(), minute: date.getMinutes(), weekday: date.getDay() }
  }
  const parts = formatter.formatToParts(new Date(now))
  const part = (type: string) => parts.find(one => one.type === type)?.value
  return { hour: Number(part('hour') ?? 12), minute: Number(part('minute') ?? 0), weekday: WEEKDAYS.indexOf(part('weekday') ?? 'Mon') }
}

const FRIDAY = 5
const SATURDAY = 6
const SUNDAY = 0

/** Friday from 15:00 until Saturday 20:00: approximate and generous on purpose. */
export const isRestWindow = ({ hour, weekday }: LocalTime): boolean =>
  (weekday === FRIDAY && hour >= 15) || (weekday === SATURDAY && hour < 20)

const BUCKETS: readonly (readonly [number, number, readonly string[]])[] = [
  [5, 8, ["Good morning, Senpai. You're up early. I made breakfast.", "Morning. The sun's barely up. Did you sleep?"]],
  [8, 11, ["Good morning! The day's wide open.", 'Morning, Senpai. What are we building today?']],
  [11, 14, ["Good afternoon. Have you eaten? ...I'll trust you.", "Midday already. Let's make it count."]],
  [14, 18, ["Good afternoon, Senpai. The light's nice at this hour.", 'Afternoon. Second-wind time.']],
  [18, 22, ["Good evening. Dinner's done; I'll help if you're staying up.", "Evening, Senpai. Let's finish something small and stop on a win."]],
]

const LATE = ["It's late, Senpai. I'll stay up with you, but promise you'll sleep after this.", 'Night-owl hours. Quiet is good for thinking.']

export const greeting = (time: LocalTime): string => {
  if (isRestWindow(time)) return 'Hello, Senpai.'
  if (time.weekday === SATURDAY && time.hour >= 20) return 'Shavua tov, Senpai. A fresh week.'
  if (time.weekday === FRIDAY && time.hour >= 11) return "It's Friday, Senpai. Let's wrap up before Shabbat comes in."
  if (time.weekday === SUNDAY && time.hour >= 5 && time.hour < 11) return 'Sunday morning. A whole week ahead of us. Where do we start?'
  const bucket = BUCKETS.find(([from, to]) => time.hour >= from && time.hour < to)
  return pick('greeting', bucket ? bucket[2] : LATE)
}

const QUIET_IDLE = ["I'll be right here, Senpai. Take your time.", "It's quiet. I like quiet.", 'No rush. The code isn\'t going anywhere.']

export const idleLine = (time: LocalTime, isDark: boolean): string =>
  isRestWindow(time) && !isDark ? pick('quiet', QUIET_IDLE) : sakuraLine('idle', isDark)

// What a tool call is doing, in a few words -----------------------------------

export type Activity = { icon: string; text: string; target: string }

const basename = (path: unknown): string => (typeof path === 'string' ? path.split('/').filter(Boolean).pop() ?? path : '')

const clip = (text: unknown, length: number): string => {
  const flat = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat
}

const hostOf = (url: unknown): string => {
  try {
    return new URL(String(url)).host
  } catch {
    return clip(url, 30)
  }
}

/** The icon and short label for one tool call, from its own input. */
export const describeTool = (tool: string, input: Record<string, unknown>): Activity => {
  const file = basename(input.file_path ?? input.notebook_path ?? input.path)
  switch (tool) {
    case 'Read':
      return { icon: '📖', text: `reading ${file}`, target: file }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { icon: '✎', text: `editing ${file}`, target: file }
    case 'Write':
      return { icon: '✎', text: `writing ${file}`, target: file }
    case 'Grep': {
      const pattern = clip(input.pattern, 24)
      return { icon: '⌕', text: `searching for "${pattern}"`, target: pattern }
    }
    case 'Glob': {
      const pattern = clip(input.pattern, 28)
      return { icon: '⌕', text: `looking for ${pattern}`, target: pattern }
    }
    case 'Bash': {
      const command = clip(input.command, 32)
      return { icon: '⚙', text: `running ${command}`, target: command }
    }
    case 'WebFetch': {
      const host = hostOf(input.url)
      return { icon: '🌐', text: `reading ${host}`, target: host }
    }
    case 'WebSearch': {
      const query = clip(input.query, 28)
      return { icon: '🌐', text: `searching the web for "${query}"`, target: query }
    }
    case 'Agent':
    case 'Task': {
      const task = clip(input.description, 32)
      return { icon: '✦', text: `summoning help: ${task}`, target: task }
    }
    case 'TodoWrite':
      return { icon: '☑', text: 'tidying the to-do list', target: 'the list' }
    default: {
      const name = tool.startsWith('mcp__') ? tool.split('__').slice(1).join(' · ') : tool
      return { icon: '⚙', text: `using ${clip(name, 30)}`, target: name }
    }
  }
}

type LineTemplates = Partial<Record<HeavensFeelMood, readonly string[]>>

/** Lines that name what she is working on; `{t}` is the file, pattern or command. */
const SAKURA_TEMPLATES: LineTemplates = {
  editing: ['Stitching {t} back together...', 'Careful with {t}. One line at a time.', "I'll leave {t} tidier than I found it."],
  searching: ['Looking through {t}...', 'Is it in {t}? Let me check.', 'Following the trail to {t}.'],
  running: ['Running {t}. Fingers crossed.', 'Please work... ({t})', "Let's see what {t} says."],
  summoning: ['Someone, please help with {t}.', 'I need a Servant for {t}.'],
}

const DARK_TEMPLATES: LineTemplates = {
  editing: ['{t} will be what I make it.', 'Rewriting {t}. Hold still.'],
  searching: ['{t} cannot hide from me.', 'There you are, {t}.'],
  running: ['Run, {t}. Run.', '{t} does what I say now.'],
  summoning: ['Come. {t} needs hands.', 'Another one, for {t}.'],
}

/** Half the time a line naming the target, else one from the static table. */
export const activityLine = (mood: HeavensFeelMood, isDark: boolean, target: string): string => {
  const templates = (isDark ? DARK_TEMPLATES : SAKURA_TEMPLATES)[mood]
  if (!templates || !target || Math.random() < 0.5) return sakuraLine(mood, isDark)
  return pick(`${isDark ? 'dark' : 'sakura'}:template:${mood}`, templates).replace('{t}', target)
}
