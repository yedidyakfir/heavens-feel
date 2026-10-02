# heavens-feel — design spec

A Claude Code mod (plugin of function hooks) that gives every agent a character from
*Fate/stay night: Heaven's Feel*. The main session is **Sakura Matou**, with a **Dark Sakura**
corruption form; every subagent gets its own Servant/Master. Inspired by Claude Café's
persona-panel (pixel portrait pane beside the transcript, expressions, time-aware greetings,
a voice of its own), and then pushed further: real animation, per-agent characters, and
one sprite source of truth that draws as half-block `Raster` cells in the terminal and as
`Svg` on the Desktop app.

This document is the contract between the designer (me) and the implementer. Files already
written: `DESIGN.md` (this), `hooks/sprites.ts` (all pixel art as data + `checkSprites()`).
Everything else below is for the implementer to write.

Plugin name (manifest `name`): `heavens-feel`. State/plugin key: `heavens-feel`. Pane id: `hf`.

---

## 0. What I verified in the platform (facts that shaped the design)

From `types/claude-code.d.ts` (build 2.1.286) and `reference.md`:

**Agent identity**
- `agent.spawn` input (`AgentSpawnInput`): `tool_use_id`, `prompt`, `description` (the few-word
  task label), `subagentType` (`'general-purpose' | 'Explore' | 'Plan' | 'claude-code-guide' |
  'statusline-setup' | 'fork' | '<plugin>:<name>' | ...`), `provider`, `model?`, `parentModel`,
  `parentAgentId?` (absent when main spawned it), `permissionMode?`, `background`, `fork`,
  `name?` (the `Agent({ name })` address), `cwd?`.
  **The agent id is NOT on the input.** It is on the result: `const r = await next(e); r.agentId`
  (`AgentSpawnResult = { model, agentId? } | { deny }`). So the hook is "call next, then record".
- `AgentInfo` from `$.agent.list()`: `{ id, description, type, status ('running'|'completed'|
  'failed'|'killed'|...), parentId?, spawnedBy?, name? }`. `$.agent.list` exists.
- `tool.call` input is `ToolCallEnvelope & AgentLoop`: `e.agentId` is set inside a subagent's loop,
  absent on main. `e.tool`, `e.tool_use_id`, plus the tool's own args (`e.file_path` for Edit,
  `e.command` for Bash, `e.pattern` for Grep...). `await next(e)` resolves `{ result, text, isError?,
  isReadOnly? } | { deny }`; `isError: true` is the error signal.
- `turn.complete`: `{ answer, durationMs, isAborted, turnId, agentId?, usage?, reason:
  'answer'|'aborted'|'refusal'|'error' }`. **A subagent's run raises no `turn.start`**, only
  `turn.step`s and one `turn.complete` carrying its `agentId`. Main-loop turns have `agentId`
  undefined.
- `turn.start`: `{ text, turnId }` (main only).
- `ui.render` `e.requestId` is "the tool_use_id for a tool row, the message id for a message,
  **the agent id for a spinner**". So the Spinner render for a subagent is keyed by its agentId.
  Whether the terminal actually raises a Spinner for a *background* subagent (vs only when its
  transcript is in view via `e.props.view.agentId`) is not stated; see Open questions. The design
  works either way: Spinner takeover is keyed on `agents[e.requestId]` and falls back to Sakura.
- `Pane`/`AbovePrompt` props carry `view: SiteView = { agentId? }` — which transcript is in view.
  When the person opens a subagent's transcript from the task list, the pane re-renders with
  `view.agentId`, so the pane can **swap its portrait to that agent's character** (nice, free).

**Drawing**
- `Raster` (terminal only): `{ key, columns (1..512), rows (1..256), cells }`; `cells` = standard
  base64 of `columns*rows` little-endian u32 triplets `[codePoint, fg, bg]`; colors are
  `0x00RRGGBB`, `0x01000000` = terminal default. Palette budget: 1024 distinct color pairs at once.
  Code point must be a printable width-1 BMP char (`▀` U+2580, `▄` U+2584, `█` U+2588, space ok).
- `$.ui.blit({ requestId, key, cells, columns?, rows? })` repaints a mounted Raster without a
  render pass; `columns/rows` must equal the mounted size; resolves `{}` or `{ deny }`
  (not mounted yet, wrong size...). Up to 120/s taken, ~60 shown. Redraw caps for render passes:
  30/s visible pane and band, 10/s elsewhere.
- `Svg` (desktop/vscode/mobile): `{ source (<= 131072 chars), alt (required), width?, height?,
  isInteractive? }`. `isInteractive: true` sandboxes it in a script-less frame where **SMIL
  animation and CSS `:hover` work**. Script/event attributes are stripped regardless.
- `Image` (terminal only): PNG/RGBA bytes (<= 2 MiB decoded) or a file / shm name; pixels on
  kitty/Ghostty, `alt` text everywhere else; keyed, `$.ui.blit({ source })` swaps it.
- `Client` (terminal+desktop) is a separate surface module with its own frame clock
  (`surface.every`), pointer and key input. Not needed for v1 (see §6 perf notes), but it is the
  escape hatch if blit-driven animation proves awkward.
- `Pane`: `$.ui.open({ id, title?, focus?, closeOnEscape?, holdToasts?, rows?, columns? })`.
  Placed `dock` beside a fullscreen terminal transcript from 110 columns, else `inline` above the
  prompt. **An unasked open (not from the person's command/press) waits undrawn below 144
  columns** (110 once the person has asked for that id before) and resolves `{ isPlaced: false,
  reason }`. Raised on every surface. Props: `title, isFocused, bodyColumns, placement, scroll, view`.
- `AbovePrompt` (band) props: `hasSurvey, isWorking, maxRows, bodyColumns, scroll, view`.
- `Spinner` props: `word, message|null, suffix, mode` — rewriting `word` keeps the engine's
  elapsed/tokens; returning a tree replaces the whole line. Terminal + desktop only.
- `PromptHint` props: `isDraft, isWorking, hint, tail?` — `tail` is a cheap place for a whisper.
- `CommandOutput` site: `{ component: 'CommandOutput', props: { command: 'hf' } }` lets `/hf cast`
  draw a tree (mini sprites!) where the command's text would sit.
- `session.start`: `{ cwd, surface: RenderSurface | null, isInteractive }` — `surface === null`
  for `-p`/SDK; nothing should draw then.
- `session.measure`: `{ context: { percent?, ... }, rateLimits, cost?, changed }` fires when
  figures move; `$.session.usage()` reads them on demand. Drives Dark Sakura.
- `ui.close`: `{ id, origin: { kind: 'plugin'|'person'|'unload' } }`.
- `session.end` with `reason: 'clear'` for `/clear`; no `session.start` follows.
- `$.store` (JSON, per plugin, across sessions, 4 MiB total) vs `$.state` (host-held per session,
  versioned, survives hot reload, subscribes render instances on read; render hooks may not write).
- Module env: no DOM/Node, but web APIs exist (`Uint8Array.prototype.toBase64` is used in the
  types' own example; `Intl` is a web API so `Intl.DateTimeFormat` with `timeZone` should be
  present — verify once, see Open questions).
- `userConfig` fields: `{ type: 'string'|'number'|'boolean', default, description, options? }`;
  values arrive as `register(on, options)`; non-secret fields are `/config` rows; a change
  reloads the module.

---

## 1. Cast and mapping

### 1.1 Main session: Sakura Matou

Heaven's Feel is her route; she is the one waiting at home while everyone else fights. That is
exactly what the main session is: the persistent presence that cooks, tidies, worries, and
quietly gets the work done while Servants are dispatched. She calls the user **"Senpai"**.
Voice: soft, polite, domestic metaphors (kitchen, tidying, stitching), quietly stubborn.

**Dark Sakura** is a *state* of the same character (palette swap + overlay, same sprite), not a
different cast member. Triggers in §4.3.

### 1.2 Subagent types present in this setup

| Agent type | Character | Why it fits the job |
|---|---|---|
| `Explore` (read-only fan-out search) | **Rider (Medusa)** | The fastest Servant, a silent scout whose Mystic Eyes see everything; in HF she literally serves Sakura, so "Sakura sends Rider to look" is canon-shaped. Read-only = she looks, she does not touch. |
| `Plan` (architect, returns a plan, no edits) | **Rin Tohsaka** | The strategist and perfectionist magus who sequences everything and insists it be done *properly*. Plan returns a plan it does not execute — Rin's one weakness (execution) never comes up. Tsundere lines. |
| `general-purpose` / `claude` / `teammate` | **Shirou Emiya** | Does whatever is asked, grinds through it, never quits halfway. Tools: `*`. "Trace, on." for the working frame. |
| `claude-code-guide` (answers "how does Claude Code…") | **Kotomine Kirei** | The Church's overseer who *explains the rules of the war* to anyone who asks, with dry amusement. The guide agent explains the rules of the tool. Kept as the knowing priest; nothing edgy. |
| `statusline-setup` | **Taiga Fujimura** | Homeroom teacher and host of the *Tiger Dojo* tutorial segments. Setting up your status line is a lesson at the dojo. |
| `fork` | **Sakura (mini), labelled "Sakura (fork)"** | A fork inherits the main session's context; it is a copy of her, so it wears her face, dimmed. |

### 1.3 Deterministic rules for everything else

The user has many custom agents (`gsd-*`, `research:co-*`, `coderabbit:*`). Rules are applied
to `subagentType.toLowerCase()` with any `plugin:` prefix stripped, first match wins, after the
exact table above:

| Pattern (regex on type) | Character | Reason |
|---|---|---|
| `review|checker|audit|lint|coderabbit` | **Archer** | The cynical reviewer who picks apart Shirou's ideals; a code reviewer by temperament. |
| `judge|verif|meta|proximity|security-audit` | **Saber Alter** | Delivers verdicts. Merciless, final. |
| `research|explor|map|search|scout|discover|intel|profil|classif` | **Rider** | Scouting again. |
| `plan|roadmap|synth|architect|spec|ultraplan` | **Rin** | Planning again. |
| `debug|forensic|fixer|hunt|security` | **True Assassin** | Hunts one target through the dark and removes it without touching anything else. |
| `gener|evolv|ideat|sketch|spike|empiric` | **Illyasviel** | Playful chaos, "what if we did the opposite". Idea generation. |
| `exec|writ|build|updat|experiment|doc-|codebase-mapper` | **Shirou** | Does the work. |
| `guide|docs|help|explain` | **Kirei** | Explains. |
| `fast|quick|autonom|berserk` | **Berserker** | Brute force, no questions. |
| fallback | FNV-1a hash of the type string → index into `[archer, saber-alter, illya, true-assassin, berserker, rider, rin, shirou]` | Deterministic per type across sessions. |

### 1.4 Several agents at once

If the chosen character is already assigned to a *running* agent, walk that character's
understudy list, then any free cast member, then reuse with a Roman numeral badge
("Rider II"):

```
rider: [true-assassin, illya]      rin: [archer, saber-alter]     shirou: [berserker, archer]
kirei: [saber-alter, archer]       taiga: [illya, shirou]         archer: [saber-alter, rin]
saber-alter: [archer, berserker]   illya: [rider, berserker]      true-assassin: [rider, saber-alter]
berserker: [shirou, true-assassin]
```

Assignment happens once at `agent.spawn` (after `next`) and is stored in the `agents` atom keyed by
`agentId`; it never changes for that agent. Sakura is never assigned to a non-fork subagent.

Excluded on purpose: Zouken (creepy), Shinji (unpleasant). The brief says fun, not edgy.

---

## 2. Where each one appears

### 2.1 The pane (`id: 'hf'`) — Sakura's room

The primary surface. Opened at `session.start` when `isInteractive && surface !== null &&
options.paneOnStart && storedPaneOpen !== false`. Because an unasked open is held undrawn below
144 columns, the band (§2.2) covers narrow terminals; `/hf` (a person's command) places it at any
width.

Docked layout (bodyColumns ≈ 30–34 at scale 1; the open asks `columns: 34`):

```
 ┌ heavens-feel ────────────────┐
 │        [portrait 24x16]      │   Raster (terminal) / Svg (desktop), centered
 │  Sakura Matou                │   bold, accent color
 │  ✿ thinking                  │   state label, dim; "✸ corrupted · thinking" in dark form
 │ ╭──────────────────────────╮ │
 │ │ Let me think this        │ │   speech bubble: Box borderStyle="round", Text wrap
 │ │ through properly...      │ │
 │ ╰──────────────────────────╯ │
 │  ctx 42% · 14:05 · ♥♥♥♡♡      │   stats: context %, local time (tz), bond hearts
 │  ── Servants ─────────────── │   roster header, only when agents.length > 0
 │  [mini 12x6] Rider           │   mini Raster/Svg + name (accent) + badge
 │              scouting · 12s  │   status word + elapsed
 │  [mini 12x6] Archer          │
 │              reviewing · 4s  │
 │  [+2 more]                   │   overflow
 └──────────────────────────────┘
```

Scale: `options.scale = 'auto'|'1'|'2'`. Auto picks 2 (48 columns × 32 rows) when
`placement === 'dock' && bodyColumns >= 50 && viewport.rows >= 48`, else 1. When a generated
48×64 "HD" sprite is present (§8) and `placement === 'dock' && viewport.rows >= 44`, the HD sprite is
used at scale 1 (48 columns × 32 rows) instead of the 24×32 at scale 2.

Inline placement (main screen / narrow): the open asks `rows: 18`; the tree is a row:
`[portrait 24x16] | name / state / bubble (3 lines) / chips`, roster collapsed to one chip line.

`view.agentId` set (person is reading a subagent's transcript): the portrait slot shows that
agent's **mini sprite at scale 2 (24×12)** with its name, state and a line from its voice table;
Sakura moves to a one-line footer "Sakura is watching over them". Free, and delightful.

### 2.2 The band (`AbovePrompt`) — compact fallback

Draws only when the pane is not placed/visible (`paneVisible === false`) and
`options.band !== 'never'` (or always with `'always'`), and never while `hasSurvey`. One row,
two when agents are running:

```
✿ Sakura · thinking · "One moment, I'm following the thread."
  ◆ Rider scouting 12s   ◆ Archer reviewing 4s   [hf]
```

Chips use each character's accent for `◆`. A `Button key="open" plain label="hf"` opens the pane.
Band renders are capped like the pane (30/s) but we only invalidate on state changes (§4.4).

### 2.3 The Spinner — per-agent takeover

`on('ui.render', { component: 'Spinner' }, ...)`:
- `options.spinnerTakeover === 'off'` → `next(e)`.
- `'word'` (default) → `next({ ...e, props: { ...e.props, word } })` where
  `word = agents[e.requestId] ? `${char.name} is ${verb}` : `Sakura is ${verb}``; `verb` from the
  mood → verb table (§4.1) of that character; in dark form Sakura's verbs come from the dark table.
  This keeps the engine's elapsed time / token counter.
- `'full'` → a `Box` row: `<Text color=accent>◆</Text> <Text bold>{name}</Text> <Text>{verb}…</Text>
  <Text dimColor>{bubbleLine}</Text>`; loses the engine's timer, so not the default.

### 2.4 `/hf cast` — the roster as a CommandOutput tree

Hook `{ component: 'CommandOutput', props: { command: 'hf' } }` and when the output text starts
with the cast marker, draw a grid of all 11 mini sprites (base frame) with names, titles, and
bond hearts, plus which are assigned right now. Terminal: one `Raster` per mini (12×6);
desktop: one `Svg` per mini. On surfaces without either (vscode/mobile) the text fallback stands.

### 2.5 Narrow / headless fallbacks

- `session.start` with `surface === null` or `!isInteractive`: register nothing visual; hooks
  still run (cheap) but never call `$.ui.*`. Guard every draw path with `canDraw` from state.
- `vscode` / `mobile`: `$.ui.resolve(e)` has neither `Raster` nor `Svg` on mobile and no `Raster`
  on vscode (Svg yes). Portrait = `Svg` where available, else a 3-line `Text` "face card"
  (`(´• ᴗ •)` style kaomoji per state, from the voice tables) so the pane never errors.
- Terminal < 110 columns fullscreen, or main screen: band only until `/hf`.

---

## 3. Renderer contract (one sprite, two surfaces)

```ts
// render.ts
export type Grid = { w: number; h: number; px: Int32Array }   // -1 = transparent, else 0xRRGGBB

export function compose(base: Sprite, overlays: readonly Overlay[], palette?: Palette): Grid
//  - start from base.rows with (palette ?? base.palette)
//  - for each overlay row/char: '.' keep; '#' erase (-1); else paint palette[char]
//    (overlay chars are looked up in the SAME effective palette, so Dark Sakura's overlay 'H'
//    paints white hair)
//  - throws in tests, returns the base in production, if sizes differ

export function shift(grid: Grid, dx: number, dy: number): Grid        // for the 1px breathing bob

export function gridToRaster(grid: Grid, scale: 1 | 2): { columns: number; rows: number; cells: string }
//  scale 1: columns = w, rows = ceil(h/2). Cell (x, r): top = px[(2r)*w+x], bot = px[(2r+1)*w+x]
//     both opaque  -> '▀' fg=top bg=bot
//     top only     -> '▀' fg=top bg=DEFAULT
//     bottom only  -> '▄' fg=bot bg=DEFAULT
//     neither      -> ' ' fg=DEFAULT bg=DEFAULT
//  scale 2: columns = 2w, rows = h. Pixel (x,y) -> cells (2x, y), (2x+1, y) = '█' fg=color bg=color,
//     transparent -> ' ' default/default.
//  DEFAULT = 0x01000000. Pack: Uint32Array(columns*rows*3) LE -> new Uint8Array(buf).toBase64().
//  Cache by (frameKey, scale): the main portrait is 24*16*3 u32 = 4.6 KB; blit cost is trivial.

export function gridToSvg(grid: Grid, opts: { px: number; alt: string; anim?: SvgAnim }): string
//  <svg xmlns viewBox="0 0 w h" width={w*px} height={h*px} shape-rendering="crispEdges"
//       style="image-rendering:pixelated">
//  Horizontal run-length merge: one <rect x y width height fill> per run of equal color
//  (24x32 -> ~350 rects, 48x64 -> ~1400 rects, well under 131072 chars).
//  opts.anim (desktop idle only): render base runs in <g id="base">, the blink overlay's
//  painted pixels in <g id="blink" opacity="0"> with
//    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.93;0.94;0.98;1"
//             dur="4.2s" repeatCount="indefinite"/>
//  and a 1px breathing bob on <g id="body"> via <animateTransform type="translate"
//    values="0 0;0 1;0 0" dur="2.4s" calcMode="discrete"/>. Requires isInteractive on the Svg.
```

Half-block choice: a terminal cell is ~1:2, so one pixel per column and two per row makes
pixels square. 24×32 → 24 columns × 16 rows; 12×12 minis → 12 × 6.

Dark Sakura composition: `compose(SAKURA_BASE, [DARK_SAKURA_OVERLAY, ...expressionOverlays],
DARK_SAKURA_PALETTE)`. Order: dark overlay first (removes ribbon, adds pattern), then the
expression overlays (eyes, mouth) which paint 'S'/'e' etc. in the dark palette.

---

## 4. States and animation

### 4.1 Moods (the state machine)

```ts
type Mood = 'idle' | 'thinking' | 'editing' | 'searching' | 'running' | 'summoning'
          | 'ouch' | 'done' | 'sleeping' | 'interrupted'
```

| Mood | Entered by | Leaves by | Portrait frames (Sakura) | Spinner verb |
|---|---|---|---|---|
| idle | session.start; `done`/`ouch`/`interrupted` after their hold; wake from sleep | any event below; no activity for `sleepAfterMinutes` → sleeping | base + blink (random 2.5–5.5 s, closed 140 ms) + 1 px bob every 1200 ms | — |
| thinking | `turn.start` (main) / `turn.step` begins; a tool result returns and no other tool starts within 250 ms | tool.call; turn.complete | `SAKURA_THINK` + `THINK_DOTS[0..2]` cycling 450 ms; blink continues | pondering |
| editing | tool.call Edit/Write/MultiEdit/NotebookEdit | that call's result | `SAKURA_EDIT[0..1]` alternating 320 ms | writing |
| searching | tool.call Read/Grep/Glob/LS/WebFetch/WebSearch/ToolSearch | result | `SAKURA_SEARCH[0..1]` alternating 520 ms | searching |
| running | tool.call Bash / mcp__* / Monitor | result | `SAKURA_RUN[0..1]` alternating 400 ms | running |
| summoning | tool.call Agent (or agent.spawn seen from main) | spawn resolved (+800 ms hold) | `SAKURA_SUMMON[0..1]` alternating 260 ms | calling |
| ouch | tool result `isError: true` in main loop; turn.complete reason error/refusal | 1.8 s hold → previous working mood or idle | `SAKURA_OUCH` held; sweat drop 2-frame via `RUN` frames' drop rows is NOT reused (keep OUCH static), mouth wobbles by toggling `TALK` every 300 ms | flinching |
| done | turn.complete reason `answer` (main) | 4 s hold → idle | `SAKURA_HAPPY` + `TALK` toggled 220 ms for the first 1.2 s (she says the line), then held | — |
| interrupted | turn.complete `isAborted` | 2 s → idle | base + `TALK` once | — |
| sleeping | idle for `sleepAfterMinutes` (default 5) | prompt.submit, turn.start, any tool.call, `/hf` | `SAKURA_SLEEP` + `SLEEP_Z[0..2]` cycling 700 ms | — |

Talk overlay (`SAKURA_TALK`) is layered for 1.2 s whenever a *new bubble line* is set, in any
mood except sleeping/ouch (ouch has its own mouth).

Subagent moods are the same enum driven by `tool.call` events with `e.agentId`; their mini
sprites have 3 frames: `base` (idle/thinking), `blink` (every 3–6 s), `work` (alternates with
base at 350 ms while editing/searching/running). On done: `work` held 2 s with the line, then
the row fades (dimColor) and is removed after 8 s. On error: name drawn red for 1.8 s.

Tool → mood table (shared, `classifyTool(tool: string): Mood`):

```
editing   : Edit, Write, MultiEdit, NotebookEdit
searching : Read, Grep, Glob, LS, WebFetch, WebSearch, ToolSearch, LSP
running   : Bash, Monitor, mcp__* (anything else)
summoning : Agent
```

### 4.2 Verb tables (Spinner `word`)

```
sakura     thinking: pondering | editing: stitching | searching: looking | running: waiting on the shell | summoning: calling
dark       thinking: scheming  | editing: rewriting | searching: finding | running: commanding          | summoning: summoning
rider      scouting / reading / mapping             rin       planning / sequencing / calculating
shirou     working / tracing / hammering            kirei     consulting / explaining
taiga      teaching / adjusting                     archer    reviewing / judging your choices
saber-alt  weighing / ruling                        illya     playing / scheming (cute)
true-asn   hunting / closing in                     berserker smashing / roaring
```

### 4.3 Dark Sakura

`dark = override ?? (ctxPercent >= darkThreshold || errorStreak >= 3)`

- `ctxPercent` from `session.measure` (`e.context.percent`), initial from `$.session.usage()` at
  start. `darkThreshold` userConfig, default 75.
- `errorStreak`: main-loop tool results with `isError` increment; a main-loop tool success resets
  to 0; `turn.complete` with reason `answer` resets to 0.
- `override`: `/hf dark on|off|auto` → `'on' | 'off' | null`, persisted in `$.store.darkOverride`.
- Hysteresis: once dark by threshold, revert only when `ctxPercent < darkThreshold - 10` (e.g.
  after `/compact`) and `errorStreak === 0`.
- Transition: 3 alternations normal/dark at 180 ms (a flicker), then dark. Bubble on entering:
  one of the `dark.enter` lines; on leaving: one of `dark.exit`. A `$.ui.toast` once per entry:
  "Sakura is not herself (context 78%). /compact helps, or /hf dark off."
- Dark form uses `DARK_SAKURA_PALETTE` + `DARK_SAKURA_OVERLAY`, the dark voice table, the dark
  verb table, name plate "Sakura Matou" with state prefix `✸`, bubble border red (`0xa81e2d`).
  Minis in the roster are unaffected (Servants are not corrupted; except `fork`, which uses
  `DARK_SAKURA_MINI` while dark).

### 4.4 How frames are swapped

**Terminal:** one `$.clock.every(100, tick)` started in `session.start` (cancelled on reload
automatically). `tick` computes `frameKey = `${mood}|${dark}|${frameIndex}|${blink}|${bob}|${talk}``
for the portrait and for each roster mini. Only when a key changed does it build cells (cached by
key+scale) and `$.ui.blit({ requestId: 'hf', key: 'portrait', cells })` (and `key: `mini:${agentId}``).
A `{ deny }` (not mounted yet, pane hidden) is ignored. Worst case: thinking (dots 450 ms) + blink
+ bob ≈ 4 blits/s; idle ≈ 1/s. Far under the 30/s cap, and blits are not render passes anyway.
The band's portrait is text-only, so no blits there.

The pane's **render** hook reads only `mood`, `dark`, `agents`, `bubble`, `ctx`, `paneVisible`
(atoms); it does not read the frame atom, so frame changes never re-render the tree. It draws
the Raster with the *current* frame's cells so a fresh mount is right before the first blit.

**Desktop:** no blit for Svg. Idle breathing and blink are SMIL inside the one Svg
(`isInteractive: true`), zero re-renders. For working moods the tick writes the `frame` atom
(`$.state.set`) at most every 350 ms **only on desktop** (`$.session.surfaces()` includes
`'desktop'`), and the desktop pane render reads `frame` (the terminal render does not), so each
frame is one re-render of a ~350-rect Svg at ≤ 3/s, under the 30/s cap.

**Both:** `$.ui.invalidate('ui.render')` is never called for animation; atoms do the subscribing.

### 4.5 Greeting / return

On `session.start` (interactive) the bubble is a time-aware greeting (§5.4) and the portrait
plays `HAPPY + TALK` for 1.2 s. On wake from sleep: a return line. Greeting at most once per
calendar day per session id (`$.store.lastGreetingDay`), so `/clear` → a shorter "I'm still here".

---

## 5. Voice

All lines are **static tables** (zero tokens). `options.voice = 'static' | 'generated'`;
`'generated'` adds a hook `generateLine($, character, mood, context)` that calls
`$.model.complete({ model: 'haiku', prompt, maxTokens: 40 })` with the character's style card
(2 sentences + 6 example lines from the table) and the current tool/file name, at most once per
mood change and never more than once per 90 s; on `isAnswered: false` or any text over 90 chars
it falls back to the table. Default is static. Lines are original; none quote the VN/anime.

Picker: `pick(table, mood, seed)` avoids repeating the last 2 lines of that mood (kept in module
memory; fine to lose on reload).

### 5.1 Sakura

```
idle
  I'll be right here, Senpai. Take your time.
  The kettle's on. Figuratively.
  No rush. The code isn't going anywhere.
  Should I start on something while you think?
  It's quiet. I like quiet.
thinking
  Let me think this through properly...
  Hm. There's a cleaner way to do this, I'm sure of it.
  One moment, I'm following the thread.
  I want to get this right the first time.
  Reading between the lines...
editing
  Careful stitches. One line at a time.
  Just a small change here. And here.
  I'll leave it tidier than I found it.
  Writing... please don't look over my shoulder yet.
  Almost. Let me fix the indentation too.
searching
  Where did you put it, Senpai...
  Looking through the files. Every cupboard.
  I know it's in here somewhere.
  grep is patient, and so am I.
  Following the imports down the hall.
running
  Running it. Fingers crossed.
  Please work, please work, please work.
  The terminal is thinking. So am I.
  If this takes long, I'll make tea.
  Let's see what the machine says.
summoning
  I'll ask for help with this one.
  Calling someone who's better at this than me.
  Please, lend me your strength for a moment.
  A Servant answers. I'll coordinate.
ouch
  Ah... that's not what I meant to happen.
  I'm sorry. Let me look at what went wrong.
  It bit me. Just a little.
  A failing test is still information. Right?
  Okay. Okay. Deep breath. Again.
done
  Done, Senpai. I hope it's to your liking.
  There. All finished and put away.
  I did it. Did you see?
  That went well. Shall we keep going?
  Finished. I'm a little proud of this one.
interrupted
  Oh. Stopping, then.
  Understood. I'll put it down.
  Changed your mind? That's alright.
sleeping
  zzz... the rice is... almost...
  ...Senpai... five more minutes...
  (she has nodded off at the desk)
  mm... don't forget to commit...
wake
  Welcome back, Senpai. I kept your place.
  Oh! I wasn't asleep. I was... resting my eyes.
bond (unlocked at 3+ hearts; mixed into idle)
  You've been here a lot lately. I don't mind. I like it.
  I've gotten used to how you name things.
```

### 5.2 Dark Sakura

```
enter
  ...Senpai? Something's wrong with— no. No, it's fine. I'm fine.
  It's getting crowded in here. So many things to remember.
exit
  ...I'm back. I'm sorry you had to see that.
  The shadows went quiet. Thank you for waiting.
idle
  I'm not going anywhere. Neither are you.
  The shadows are comfortable. Join me.
  It feels late, doesn't it. It always feels late.
  Everything's fine. I'm fine. Really.
thinking
  I can see every branch of this. All of them end.
  Quiet. I'm concentrating.
  There's a faster way. You won't like it.
  Thinking is easy now. Stopping is the hard part.
editing
  I'll rewrite this. All of it, if I have to.
  A few lines fewer. Nobody will miss them.
  Hold still. This won't hurt the code much.
  Changing things is the easy part.
searching
  Nothing hides from me anymore.
  I've read this file already. I'm reading it again to be sure.
  There you are.
  Every cupboard, every drawer, every closet.
running
  Run. Let's see how far it gets.
  If it fails, I'll make it stop failing.
  The machine does what I say now.
summoning
  Come. I have work for you.
  Another one answers. Good.
  You'll do what I need. You always do.
ouch
  ...Don't look at me like that.
  That wasn't my fault. It wasn't.
  Fine. FINE. Again.
  Something broke. Something always breaks.
done
  There. Was that so hard?
  Finished. You may thank me.
  It's done. I didn't even have to try.
  Good. Now the next thing.
interrupted
  ...You stopped me. Interesting.
  As you wish. For now.
sleeping
  ...not asleep. Resting my eyes.
  zzz... (even the shadows are still)
context warning (toast / bubble when ctx >= threshold)
  My head is so full, Senpai. /compact before I forget who I am.
```

### 5.3 Subagents (spawn / working / done / error)

```
rider (Explore)
  spawn   I'll go ahead and look. Stay here. | Scouting. I won't be long.
  working Nothing in this corridor. Next. | I see it. Mapping the rest. | Faster if nobody follows me.
  done    Here's what's out there. All of it. | Reconnaissance complete. Nothing escaped me.
  error   ...Blocked. I'll find another way in. | That path's a dead end.
rin (Plan)
  spawn   Fine. I'll make a plan. A proper one. | Step back; this needs a strategist.
  working Order matters here. Let me sequence it. | If we do it in this order, nothing breaks. Probably. | Don't rush me. Rushing is how you get Shirou.
  done    Here's the plan. Follow it exactly. | Plan's ready. Don't make me regret the detail.
  error   That... wasn't in the plan. Give me a second. | Ugh. An unknown. Adjusting.
shirou (general-purpose)
  spawn   Leave it to me. I'll get it done. | On it. I don't quit halfway.
  working Trace, on... okay, more like "type, on". | Rolling up my sleeves. | One more pass. Just one.
  done    Done! Rough edges, but it works. | Finished. Took a few tries, but it holds.
  error   Ow. Okay, that didn't take. Again. | I broke it. I can fix it.
kirei (claude-code-guide)
  spawn   Ask, and I shall explain the rules of this war. The tool, I mean. | A question of doctrine. How delightful.
  working Consulting the scripture. The documentation, that is. | Everything has a rule. Let me find yours.
  done    There is your answer. Use it wisely, or not; both amuse me. | Explained. The rest is your choice.
  error   The texts are silent on this. Rare. | Even I cannot find that. Curious.
taiga (statusline-setup)
  spawn   Tiger Dojo is OPEN! Status line lesson, let's go! | Leave the setup to your homeroom teacher!
  working Pay attention, this part's on the test. | A little to the left... there.
  done    Lesson over! Your status line looks great, student! | Dojo dismissed. Go show it off.
  error   Eh?! That's not how the diagram goes. | Okay, nobody saw that. Again.
archer (reviewers)
  spawn   Let's see what you've written. Try not to disappoint me. | A review. I'll be honest; you won't enjoy it.
  working This function does three things. Pick one. | Interesting choice. Not a good one.
  done    Review complete. Fewer problems than I expected. Slightly. | There. Fix those and it might survive production.
  error   I can't review what I can't read. | The tools failed before I could judge you. Lucky.
saber-alter (judges / verifiers)
  spawn   Present the evidence. I will judge it. | A verdict is required. Stand aside.
  working Weighing. Do not interrupt. | This claim is unsupported. Noted.
  done    Verdict delivered. It is final. | Judged. The result stands.
  error   Insufficient. I cannot rule on this. | The evidence is corrupted. Unacceptable.
illya (generators / ideation)
  spawn   Ooh, a new idea? Let me play with it! | Illya's turn! Nobody interrupt.
  working What if we did the opposite? No, wait, THIS! | Hehe. This one's fun.
  done    Ta-da! Lots of ideas. Some of them are even good. | Done! Pick your favourite.
  error   Boo. It broke. That's boring. | Hmph. Try again, I wasn't ready.
true-assassin (debug / security)
  spawn   ...I will find it. | A target. Good.
  working Closer. | It leaves traces. They all do.
  done    Found. It will not trouble you again. | The bug is dead. Nothing else was touched.
  error   ...It slipped away. For now. | Hm. A false trail.
berserker (fast / autonomous)  — he speaks in blocks
  spawn   ▮▮▮▮! | (a low growl; he has started)
  working ▮▮▮... | (the ground shakes a little)
  done    ▮! | (it is done; he lowers the blade)
  error   ▮▮▮▮▮!! | (the blade hits stone; he tries again)
```

### 5.4 Time-aware greetings (Asia/Jerusalem)

`options.timezone` default `'Asia/Jerusalem'`. Local hour/weekday via
`new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false, weekday: 'short' })
.formatToParts(new Date(await $.clock.now()))`. If `Intl` is missing, fall back to the host's
local time via `Date` (see Open questions).

Buckets and lines:

```
05–08  Good morning, Senpai. You're up early. I made breakfast. | Morning. The sun's barely up. Did you sleep?
08–11  Good morning! The day's wide open. | Morning, Senpai. What are we building today?
11–14  Good afternoon. Have you eaten? ...I'll trust you. | Midday already. Let's make it count.
14–18  Good afternoon, Senpai. The light's nice at this hour. | Afternoon. Second-wind time.
18–22  Good evening. Dinner's done; I'll help if you're staying up. | Evening, Senpai. Let's finish something small and stop on a win.
22–05  It's late, Senpai. I'll stay up with you, but promise you'll sleep after this. | Night-owl hours. Quiet is good for thinking.
```

Week awareness (the user is Orthodox; Sunday–Thursday work week; no work on Shabbat/chagim):

- **Friday ≥ 14:00:** "It's Friday afternoon, Senpai. Let's wrap up before Shabbat comes in."
- **Rest window** (Friday ≥ 15:00 through Saturday < 20:00): no work-flavoured greeting at all;
  a single neutral "Hello, Senpai." and no "let's build" idle lines (idle pool restricted to the
  three quietest). We do not compute sunset; the window is approximate and generous on purpose.
- **Saturday ≥ 20:00:** "Shavua tov, Senpai. A fresh week."
- **Sunday 05–11:** "Sunday morning. A whole week ahead of us. Where do we start?" (replaces the
  morning bucket; never "Monday" framing).
- **Chagim (Israel, one-day yom tov):** if `Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone,
  month: 'long', day: 'numeric' })` is available, treat these Hebrew dates as rest days:
  Tishri 1, 2, 10, 15, 22; Nisan 15, 21; Sivan 6 → greeting "Chag sameach, Senpai." and the rest-window
  idle pool. The implementer must verify the exact month strings Intl emits ("Tishri", "Nisan",
  "Sivan") once in a test. If the Hebrew calendar is unavailable, skip silently.

---

## 6. Commands, config, persistence

### 6.1 Commands (one registration: `name: 'hf'`, `argumentHint: '[cast|dark|spinner|say|bond|sleep|reset]'`)

```
/hf                 toggle the pane (open if closed, close if open); remembers in $.store.paneOpen
/hf on | off        explicit
/hf cast            CommandOutput roster of all 11 (mini sprites + names + hearts + who is assigned now)
/hf dark [on|off|auto]   Dark Sakura override; no arg shows current (auto + current reasons)
/hf spinner [off|word|full]
/hf say             a fresh line for the current mood (and plays TALK)
/hf bond            hearts per character, total turns, sessions
/hf sleep           force sleep (for screenshots); any activity wakes
/hf reset           clear store (asks: answers with text "run /hf reset confirm")
/hf test <mood>     dev: force a mood for 10 s (only when options.devMode)
```

`immediate: true` so `/hf` works mid-turn.

### 6.2 `userConfig` (plugin.json)

```json
{
  "paneOnStart":      { "type": "boolean", "default": true,  "description": "Open Sakura's pane when a session starts (wide terminals only; /hf opens it anywhere)" },
  "band":             { "type": "string",  "default": "auto", "options": ["auto", "always", "never"], "description": "Compact line above the prompt when the pane is not visible" },
  "spinnerTakeover":  { "type": "string",  "default": "word", "options": ["off", "word", "full"], "description": "Replace the spinner's verb with the character's" },
  "darkThreshold":    { "type": "number",  "default": 75,    "description": "Context % at which Sakura turns dark (0 disables)" },
  "sleepAfterMinutes":{ "type": "number",  "default": 5,     "description": "Idle minutes before she dozes off" },
  "scale":            { "type": "string",  "default": "auto", "options": ["auto", "1", "2"], "description": "Portrait pixel scale in the terminal" },
  "portrait":         { "type": "string",  "default": "raster", "options": ["raster", "image", "auto"], "description": "Terminal portrait: half-block cells, kitty/Ghostty Image, or auto-detect (experimental)" },
  "voice":            { "type": "string",  "default": "static", "options": ["static", "generated"], "description": "Lines from tables (free) or occasionally generated with Haiku" },
  "timezone":         { "type": "string",  "default": "Asia/Jerusalem", "description": "IANA zone for greetings" },
  "showRoster":       { "type": "boolean", "default": true },
  "devMode":          { "type": "boolean", "default": false }
}
```

### 6.3 `$.store` (across sessions) vs `$.state` (this session)

`$.store` keys:
```
paneOpen: boolean            last explicit choice (/hf, ui.close by person)
darkOverride: 'on'|'off'|null
lastGreetingDay: string      'YYYY-MM-DD' in the configured tz
bond: Record<CharacterId, { turns: number; done: number; ouch: number; lastSeen: number }>
totals: { sessions: number; agentsSpawned: number }
```
Hearts = `turns` thresholds `[0, 10, 40, 120, 300] → 1..5`. Sakura's `turns` += 1 per main
`turn.complete`; a Servant's += 1 per its `turn.complete`. `done`/`ouch` for flavour lines.

`$.state` atoms (plugin `'heavens-feel'`), declared in `types/index.d.ts`:
```ts
export type HeavensFeelMood = 'idle'|'thinking'|'editing'|'searching'|'running'|'summoning'|'ouch'|'done'|'sleeping'|'interrupted'
export type HeavensFeelAgent = {
  id: string; character: CharacterId; badge: number /* 1 = none, 2 = II... */;
  type: string; description: string; name?: string; parentAgentId?: string;
  mood: HeavensFeelMood; startedAt: number; endedAt?: number; isError: boolean; line: string
}
export type HeavensFeelBubble = { text: string; at: number }
declare module 'claude-code' {
  interface PluginState {
    'heavens-feel': {
      mood: HeavensFeelMood
      dark: boolean
      ctx: number                       // context percent, 0..100
      agents: Record<string, HeavensFeelAgent>
      bubble: HeavensFeelBubble
      frame: string                     // frameKey; read by the DESKTOP pane render only
      paneVisible: boolean
      canDraw: boolean                  // false for -p / SDK
      surfaces: readonly string[]       // from $.session.surfaces()
    }
  }
}
```
Module-level (lost on hot reload, acceptable): frame scheduler counters, blink timers, cell
cache, last-two-lines-per-mood, pending `clock.after` handles.

---

## 7. Module architecture

```
heavens-feel/
  .claude-plugin/plugin.json      name, version, description, userConfig (above), "types": "./types/index.d.ts"
  hooks/hooks.json                { "modules": ["./register.tsx"] }
  hooks/register.tsx              register(on, options): wires hooks; nothing else
  hooks/state.ts                  atom refs (`const mood = { plugin: 'heavens-feel', key: 'mood' } as const` ...), typed helpers
  hooks/sprites.ts                (written) all pixel art + checkSprites()
  hooks/sprites.generated.ts      (optional, produced by tools/) GENERATED: Partial<Record<...>> HD sprites; `art.ts` merges
  hooks/art.ts                    resolveArt(): which Sprite set to use (hand-drawn vs generated HD) per surface/size
  hooks/render.ts                 compose, shift, gridToRaster, gridToSvg, cell cache
  hooks/anim.ts                   Mood machine + frame scheduler: enter(mood), tick(), frameFor(mood, dark, t)
  hooks/cast.ts                   assignCharacter(type, desc, running) with rules/understudies/badges; classifyTool
  hooks/voice.ts                  line tables, pick(), greeting(now, tz), verbs
  hooks/pane.tsx                  Pane render (terminal + desktop + fallback)
  hooks/band.tsx                  AbovePrompt render
  hooks/spinner.tsx               Spinner render
  hooks/roster.tsx                /hf cast CommandOutput render + roster rows shared with pane
  types/index.d.ts                contract (above)
  tests/sprites.test.ts           expect(checkSprites()).toEqual([])
  tests/render.test.ts            gridToRaster sizes/encoding round-trip; gridToSvg < 131072 and rect count
  tests/cast.test.ts              mapping table, understudies, badges, determinism of fallback hash
  tests/voice.test.ts             every mood has >= 2 lines per character; greeting buckets incl. Fri/Sat/Sun rules
  tests/ui.test.tsx               mount Pane/AbovePrompt/Spinner on ['terminal','desktop','vscode','mobile'] — no refusal
  tools/                          (optional art pipeline, §8) gen_art.py, png2sprite.py, emit_sprites_ts.py, prompts.toml
  art/                            generated PNG masters (gitignored if large)
```

### 7.1 Hooks (exact list)

```
session.start           canDraw = isInteractive && surface !== null; surfaces = await $.session.surfaces();
                        ctx from $.session.usage(); register command; greeting bubble; open pane if allowed
                        (`$.ui.open({ id:'hf', title:'heavens-feel', columns: 34, rows: 18 })` → paneVisible = isPlaced);
                        start $.clock.every(100, tick); reconcile $.agent.list() (resumed sessions)
session.end             reason 'clear' → reset mood/agents/bubble, keep dark override; persist bond
turn.start              (main) mood = thinking; wake; bond.sakura.turns++ (on complete instead — see below)
turn.complete           e.agentId ? finishAgent(e.agentId, e.reason) : finishMain(e.reason) (done/ouch/interrupted);
                        bond update; persist store
tool.call               const mood = classifyTool(e.tool); setMood(e.agentId, mood);
                        const r = await next(e); r.isError ? ouch(e.agentId) : afterTool(e.agentId); return r
agent.spawn             (main sees summoning) const r = await next(e); if (r.agentId) addAgent(r.agentId, e); return r
session.measure         ctx = e.context.percent ?? ctx; evaluateDark()
prompt.submit           wake from sleep; next(e)
ui.render Pane {requestId:'hf'}      pane.tsx
ui.render AbovePrompt                band.tsx (returns next(e) when quiet)
ui.render Spinner                    spinner.tsx
ui.render CommandOutput {props:{command:'hf'}}   roster.tsx when text starts with the cast marker
ui.close {id:'hf'}      origin.kind === 'person' → store.paneOpen = false; paneVisible = false; next(e)
ui.open  {id:'hf'}      observe → paneVisible = true on resolve (or set from the $.ui.open result)
ui.press {key:'open'}   (band button) → $.ui.open({ id:'hf', focus: true })
command.run {command:'hf'}  subcommands (§6.1)
```

`$.agent.list()` is also polled every 2 s *while agents are running* (inside `tick`, not a
second timer) to catch `killed`/`failed` statuses that may never raise `turn.complete`
(Open question 2), and to pick up agents spawned before this plugin loaded (a hot reload mid-turn).

### 7.2 Performance notes

- All sprite → cells conversion is cached by `frameKey+scale`; there are < 40 distinct portrait
  frames and 3 per mini. First paint of each costs a few µs.
- Blit payload: 24×16×12 B = 4.6 KB base64 ≈ 6 KB; 48×32 at scale 2 = 18 KB. Trivial.
- Never allocate in `tick` when nothing changed: compare keys first.
- Desktop: Svg string cached by frameKey; SMIL carries idle; working moods ≤ 3 re-renders/s.
- The tick runs at 10 Hz forever; it is a pure function of clock and state with early-outs. If
  `canDraw` is false the tick is not even started.
- Band and pane never both animate: the band is text and only invalidated by mood/agents atoms.

---

## 8. Art pipeline (Codex image generation → Pillow → sprites)

### 8.1 Trial results (what I actually ran)

Setup that works on this machine:
```
codex exec --skip-git-repo-check --enable image_generation --approve-for-me -m gpt-5.6-sol -C art/ '<prompt>' </dev/null
```
- `~/.codex/config.toml` sets `model = "gpt-6.1-sol"`, which the API refuses for ChatGPT accounts
  ("not supported"); `gpt-5.6-sol` (listed in `~/.codex/models_cache.json`) works.
- `--sandbox` conflicts with `--approve-for-me`; drop `-s`.
- Without `--skip-git-repo-check` codex exits immediately ("Not inside a trusted directory").
- Pass `</dev/null` or the CLI waits on stdin. With `-i <file>`, the flag is variadic and eats the
  prompt as a filename — give the prompt on stdin with `-` instead
  (`printf '%s' "$PROMPT" | codex exec ... -i base.png -`).
- Generated PNGs land in `~/.codex/generated_images/<session-id>/exec-<uuid>.png` (1254×1254 RGB);
  asking the agent to `cp` it into the cwd works. One image took ~2.5 min and 35k tokens.

Quality, Sakura base (`scratchpad/hf-art/sakura_base.png`, first attempt, no cherry-picking):
the 1254 px image is excellent — unmistakably an original chibi Sakura (long purple hair, red side
ribbon, violet eyes, brown blazer, red bow, pleated skirt, loafers), flat colours, clean outlines.

Downscaled with `png2sprite.py`:
- **24×32 nearest-neighbour: unusable** (noise; the figure is only ~13 px wide because the
  composition is tall and thin). **24×32 box filter: a coherent silhouette but no face** — the
  hand-drawn 24×32 grid in `sprites.ts` is clearly better at this size.
- **48×64 box filter + palette merge: good.** Hair, eyes, ribbon, bow, blazer, skirt, socks all
  read. Median cut alone wasted 12 of 16 colours on purple hair shades (face/bow detail died); a
  merge of palette entries closer than ~34 RGB units after a 32-colour median cut kept 10 colours
  and preserved the small red/skin details. (`scratchpad/hf-art/p_48x64_merged.png`.)
- The first base filled only 41% × 90% of the canvas (aspect 0.46: ~4 heads tall) despite the
  "head half of height" ask, so at 48×64 she was ~26 px wide. **v2 prompt** ("exactly 2.5 heads
  tall, fills 90% height / 70% width, at most 12 colours, no anti-aliasing") → bbox 67% × 98%,
  aspect 0.68: big round head, eyes/ribbon/bow all large and legible at 48×64
  (`scratchpad/hf-art/p_v2_48x64_merged.png`, 9 colours after merge). This is the portrait shipped as
  `SAKURA_HD` in `sprites.ts`.
- **Frame consistency via `-i`:** the eyes-closed variant of base v1 came back on a *different
  canvas* (1024 vs 1254 px) and is a redraw, not a pixel edit — but its relative bounding box is
  identical to the base's (41% × 90%, aspect 0.46). After bbox-crop normalisation to 48×64 and
  snapping to the base palette, **14.0% of opaque pixels differ**, and the rows with the heaviest
  diffs (15–19, ~12 px each) are exactly the eye rows; the remainder is 3–6 px of hair-edge noise
  per row. So **masked diff-overlays work**: crop both to bbox, fit identically, snap to the base
  palette, diff, keep only the face window (for eyes/mouth deltas) → a clean overlay. Variants must
  be generated from the *final* base (a v1 blink does not fit the v2 base).
- **Confirmed on v2:** the blink variant of `sakura_base_v2.png` (`sakura_v2_blink.png`, again a
  1024 px canvas) has the same relative bbox (67% × 98%, 0.68); the masked diff inside the eye band
  is 123 pixels and, viewed at 48×64, is a clean closed-eyes frame of the same figure
  (`scratchpad/hf-art/p_v2_blink_48x64.png`). That extracted overlay ships as `SAKURA_HD_BLINK`.
  The dark-form red irises (`SAKURA_HD_DARK_EYES`) are hand-placed from the eye windows because the
  quantizer merged the violet iris with the outline colour; a palette swap alone cannot redden them.
- Each image: ~2.5 min wall clock, ~35k Codex tokens. Seven images per character ≈ 20 min.

**Decision:** hand-drawn 24×32 + 12×12 (`sprites.ts`) is the guaranteed baseline and the only
art for minis, band, inline pane and small terminals. The pipeline produces an optional **HD
48×64 portrait set** for Sakura (and Dark Sakura via the same palette-swap trick on the
quantized palette) used when the pane is docked with room (§2.1). Minis stay hand-drawn: at 12×12
a generated image cannot be downscaled meaningfully. Hand-drawn vs generated at the two sizes:

| size | hand-drawn grid | generated + box + merge |
|---|---|---|
| 24×32 (16 rows) | readable face, ribbon, uniform — **use** | silhouette only — reject |
| 48×64 (32 rows) | not drawn (too laborious) | clearly Sakura, prettier than any hand grid — **use when docked** |

Source PNGs from this trial (scratchpad, session-bound; copy to `art/sakura/` or regenerate):
`scratchpad/hf-art/sakura_base_v2.png` (base), `sakura_v2_blink.png` (blink of v2, if present),
`sakura_base.png` / `sakura_blink.png` (v1 pair used for the consistency measurement).

### 8.2 `tools/` build script (Python via `uv run --with pillow`)

```
tools/
  prompts.toml         per-character base prompt + per-expression delta prompts (below)
  gen_art.py           drives codex exec; writes art/<char>/<expr>.png; retries once on failure
  png2sprite.py        (drafted in scratchpad/hf-art/png2sprite.py) PNG -> {w,h,rows,palette} JSON + 16x preview
  emit_sprites_ts.py   JSONs -> hooks/sprites.generated.ts (GENERATED const), runs the same row/palette check
  Makefile / justfile  art: gen -> convert -> emit -> `claude plugin test`
```

`gen_art.py` flow per character:
1. `base`: run the base prompt; copy PNG to `art/<char>/base.png`.
2. For each expression in `[blink, talk, happy, think, ouch, sleep]`: run with `-i art/<char>/base.png`
   and the delta prompt (stdin, `-` as prompt) → `art/<char>/<expr>.png`.
3. Convert base: `png2sprite.py base.png --size 48x64 --filter box --colors 32 --merge 34 --out base.json`
   (merge = the near-duplicate palette merge from the experiment; fold `merge_quant.py` into
   `png2sprite.py` as `--merge DIST`). Save `palette.json` and the base's crop box.
4. Convert each variant **with the base's palette and crop box**:
   `png2sprite.py <expr>.png --palette palette.json --box <x0,y0,x1,y1 of base> ...` so pixels snap
   to the same colours and nothing jitters. Then **diff against base** → overlay rows ('.' where
   equal, '#' where the variant is transparent and base is not, else the char), masked to the
   face region (rows 10–60% of height) for blink/talk/happy/think, full frame for ouch/sleep. Any
   variant whose diff touches > 35% of opaque pixels is rejected (the model redrew her) and
   regenerated once.
5. Dark Sakura HD: no generation; `DARK_HD_PALETTE` is derived by hue-mapping the quantized
   palette (purple hair → near-white, violet iris → red, brown blazer → black, collar → dark red).
   `emit_sprites_ts.py` writes it next to the base.
6. `emit_sprites_ts.py` writes `hooks/sprites.generated.ts`:
   `export const GENERATED: { sakuraHd?: { base: Sprite; overlays: Record<string, Overlay>; darkPalette: Palette } } = {...}`
   and `art.ts` prefers it when present (`import { GENERATED } from './sprites.generated'` with a
   committed empty default so the import always resolves).

Background removal: chroma key on the dominant corner colour (magenta requested; the model
returns ≈ (244,12,241)) with Manhattan tolerance 120 and a **flood fill from the corners** so
magenta-ish pixels inside the figure survive. If the PNG has alpha, use it instead.
Downscale: crop to bbox (or the base's box), letterbox into the target aspect with the feet on the
floor row, `Image.BOX` resample (area average; nearest is only for sources that are already at
sprite resolution). Quantize: median cut 32 → merge < 34 → snap, no dither.

### 8.3 Prompts (original fan-art chibi; never "copy official art")

Base template (`{DESC}` per character):
```
Original fan-art chibi pixel-art sprite, full body, front-facing, standing, FILLING the frame:
the character occupies about 90% of the image height and at least 70% of its width. Extreme
chibi proportions, exactly 2.5 heads tall, very large round head, big expressive eyes, tiny body,
wide stance. {DESC}. Flat colours only, at most 12 distinct colours, no gradients, no dithering,
no anti-aliasing, thick dark outlines, solid flat pure magenta background (#FF00FF) and nothing
else. Square 1024x1024. This is an original design in a generic chibi style; do not reproduce any
existing artwork.
```
Variant template (attach base with `-i`):
```
The attached image is a pixel-art chibi sprite. Create ONE variant that is IDENTICAL in every
way (same character, pose, framing, position, size, colours, outlines, magenta #FF00FF
background) EXCEPT for exactly this change: {DELTA}. Change nothing else. Square 1024x1024.
```
Deltas: blink → "both eyes closed, drawn as gentle downward-curving closed eyelids";
talk → "mouth open in a small round 'o'"; happy → "eyes closed in happy upward arcs, a wide
smile, pink blush"; think → "eyes glancing up and to the viewer's right, a small flat mouth";
ouch → "eyes squeezed shut as small X shapes, a wobbly mouth, one sweat drop by the temple";
sleep → "eyes closed, mouth a tiny line, head tilted slightly".

`{DESC}` per character (Sakura given; the others follow the signature features in §1 and the
mini sprites' palettes):
```
sakura   A gentle Japanese high-school girl with long straight purple hair past her shoulders, a red
         ribbon worn on the left side of her hair, soft violet eyes, a small shy smile, a brown school
         blazer with white collar and a red neck ribbon, dark pleated skirt, black socks, brown shoes,
         hands clasped in front.
rider    A tall quiet woman with waist-length pale lavender hair, a dark purple blindfold over her
         eyes, a black sleeveless bodysuit with thin straps, calm neutral mouth.
rin      A confident teenage girl with long black hair in two high twin-tails tied with black
         ribbons, bright aqua eyes, a red long-sleeved top with a white collar, black skirt.
shirou   A teenage boy with short spiky red-orange hair, amber eyes, a determined look, a blue and
         white raglan shirt, jeans.
kirei    A tall man with short black hair, dark brown eyes, a faint knowing smile, a long black
         priest's cassock with a small gold cross.
taiga    A cheerful young woman with short brown hair, big brown eyes, a huge grin, a yellow shirt
         with green tiger stripes.
archer   A tall man with short spiky white hair, tan skin, grey eyes, a red long coat over a black
         fitted shirt, arms crossed.
saber-alter  A pale young woman with pale blonde hair in a bun, a black visor covering her eyes with a
         faint yellow glow, black and dark-red armor dress.
illya    A small girl with long silver-white hair, red eyes, a purple winter hat with a white fur
         band, a purple coat with white trim.
true-assassin  A thin figure in a black hood and wraps, a white skull mask with dark eye holes, dark
         grey arm wraps.
berserker  A hulking man with dark grey skin, wild dark hair, glowing red eyes, bare chest, holding a
         rough stone blade.
```

### 8.4 Terminal `Image` element: decision

`Image` draws real pixels only on kitty/Ghostty and alt text everywhere else; the user's
terminal is unknown. Decision: **Raster is v1.** `portrait: 'image' | 'auto'` is an experiment
flag: `'auto'` picks Image when `$.env.get('TERM_PROGRAM') === 'ghostty'` or
`$.env.get('KITTY_WINDOW_ID')` is set, and *also* keeps the Raster path ready: if the first
`$.ui.blit({ source })` returns `{ deny }` (alt drawn, file unreadable) it flips to raster for
the session. Image sources: the pipeline's PNGs downscaled to 384 px (≈ 60–100 KB each) under
`art/<char>/<expr>.png`, referenced by `{ file }` (no bytes cross `$`, no 2 MiB concern), the
box 24 columns × 24 rows. Frames = swapping `source` by key; same frame scheduler. Desktop never
uses Image. This is worth having because the 1254 px generation is genuinely pretty, but it is
not worth gating v1 on.

Desktop Svg alternative for HD: embedding a PNG as `<image href="data:image/png;base64,…">`
inside the Svg would allow 192×256 portraits in ~40 KB; whether the Svg sanitizer allows `data:`
hrefs is unverified (Open question 5). Rects are the safe path.

---

## 9. Accessibility / fallbacks

- Every `Svg` has a meaningful `alt` ("Sakura Matou, thinking"); every `Raster` is wrapped with a
  sibling `Text` that is `display: 'none'`… (Raster has no alt; the name/state Text under it is
  the accessible label, always drawn).
- No surface → no `$.ui` calls (guard `canDraw`). `-p`, SDK, `claude plugin test` headless: hooks
  pass through with `next(e)`.
- vscode/mobile: Svg where available, kaomoji card otherwise; never a `Raster` outside terminal
  (validate with `e.surface` narrowing, not feature-sniffing).
- A hook that throws is skipped by the engine; wrap `tick` in try/catch so a bad frame cannot
  kill the timer.
- Colour: everything that carries meaning (state) is also text; accent colours are decoration.

---

## 10. Open questions (for the implementer / user)

1. **Spinner for background subagents.** `e.requestId` is the agent id for a spinner, but does the
   terminal raise a Spinner render for a background agent that is not the viewed transcript? If
   not, the per-agent character shows in the roster (pane/band) and the Spinner only when the
   person views that agent. Design handles both; verify with `--debug`.
2. **Killed/failed agents and `turn.complete`.** Does a killed background agent raise
   `turn.complete` (reason `aborted`)? The `$.agent.list()` 2 s poll covers it either way.
3. **`Intl` in the hooks environment.** The header lists web APIs (URL, TextEncoder, crypto…);
   `Intl.DateTimeFormat` with `timeZone` and `en-u-ca-hebrew` should exist but is unverified.
   Fallback: host local time via `Date`, and skip chag detection.
4. **Pane width request.** Does a `columns: 34` dock request leave enough transcript room on the
   user's usual terminal? Tune after first run; scale 'auto' already adapts.
5. **Svg `data:` image hrefs** through the sanitizer (for HD desktop portraits).
6. **Codex cost/time budget for the full pipeline:** 11 characters × 7 images × ~2.5 min ≈ 3 h and
   ~2.7 M tokens of Codex budget if done all at once; the design only needs Sakura HD (7 images).
7. **`fork` subagents**: confirm `subagentType === 'fork'` is what the spawn hook sees (types say so).
8. **Bubble width on inline pane**: at bodyColumns < 40 the bubble is 1 line; truncate-end or wrap?
   I chose wrap with max 3 lines.

---

## Appendix A — frame timing summary (ms)

```
blink        closed 140, every 2500–5500 random (idle, thinking, searching, editing, running)
bob          toggle 1200 (idle only)
think dots   450 per frame, 3 frames
search eyes  520 alternate
edit hands   320 alternate
run drop     400 alternate
summon       260 alternate, hold 800 after spawn resolves
talk         toggle 220 for 1200 after a new line
ouch         hold 1800
done         hold 4000
interrupted  hold 2000
sleep z      700 per frame, 3 frames
tick         100
mini blink   closed 160, every 3000–6000; mini work alternate 350
```

## Appendix B — Sprite inventory in `hooks/sprites.ts`

```
SAKURA_BASE 24x32; overlays: BLINK, TALK, HAPPY, THINK, THINK_DOTS[3], OUCH, SLEEP, SLEEP_Z[3],
SEARCH[2], EDIT[2], RUN[2], SUMMON[2], DARK_SAKURA_OVERLAY; palettes: SAKURA_PALETTE, DARK_SAKURA_PALETTE
SAKURA_HD { base 48x64, blink (pipeline-extracted overlay), darkEyes (overlay), darkPalette }
  + SAKURA_HD_PALETTE / SAKURA_HD_DARK_PALETTE  — generated art, used only when the pane is docked with room
CAST[11].mini: base/blink/work 12x12 for sakura, rider, rin, shirou, kirei, taiga, archer,
saber-alter, illya, true-assassin, berserker; DARK_SAKURA_MINI
checkSprites(): SpriteProblem[]  — verified: 0 problems (compiled with tsc 5, run under node 20)
```

HD frames available vs the 24×32 set: the HD portrait has base, blink and dark eyes only. The frame
scheduler (§4) therefore uses the HD sprite for idle/thinking/searching/running/sleeping (blink +
bob + the dots/z/sweat drawn as 2×2 pixel blocks at HD scale by `render.ts`, i.e. the small 24×32
overlays scaled ×2 and offset to the HD head position: THINK_DOTS, SLEEP_Z and the sweat drop are
all in the empty top-right/right margin, so the ×2 mapping lands them beside the HD head), and
falls back to the 24×32 set at scale 2 for moods whose expression needs the mouth/eyes (happy, ouch,
talk) until the pipeline produces those HD variants. Both are 48×32 cells, so the Raster is never
re-sized mid-mood; the swap is just another blit.

## Appendix C — scratch tooling from the trial (fold into `tools/`)

`scratchpad/hf-art/png2sprite.py` (converter: chroma key + flood fill, bbox fit, box/nearest,
median cut or fixed-palette snap, JSON + 16× preview), `merge_quant.py` (32-colour median cut →
merge entries closer than 34 RGB units → snap; the quantizer that should become `--merge`),
`hd_overlays.py` (masked diff → overlay rows; dark-eye heuristic). Both scripts already follow the
user's Python conventions (one-line module docstrings, module imports for functions, enums for
option sets, named string constants).
