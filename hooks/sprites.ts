// heavens-feel: pixel art as pure data. No imports from claude-code; no runtime
// dependencies. Rendering (half-block Raster cells / SVG rects) lives in render.ts.
//
// Format
//   Sprite.rows: equal-length strings, one char per pixel.
//   Sprite.palette: char -> 0xRRGGBB. '.' is transparent in a base frame.
//   Overlay rows use the same chars, where '.' means "keep the base pixel" and
//   '#' means "erase to transparent". Overlays are the same size as their base.
//   A Frame = base composed with zero or more overlays, then an optional palette
//   override (Dark Sakura is the Sakura base + DARK_SAKURA_OVERLAY + DARK_SAKURA_PALETTE).
//
// Sizes: main portrait 24w x 32h (16 terminal rows with half-blocks),
//        mini sprites 12w x 12h (6 terminal rows).
//
// Everything here is original chibi fan art drawn by hand for this mod.

import type { HeavensFeelCharacter, HeavensFeelMaster } from '../types'

export type Palette = Record<string, number>

export type Sprite = {
  w: number
  h: number
  rows: readonly string[]
  palette: Palette
}

/** An overlay: same size as its base; '.' keeps, '#' erases, anything else paints. */
export type Overlay = Sprite

export type CharacterId = HeavensFeelCharacter

export type MiniSet = {
  /** Resting frame. */
  base: Sprite
  /** Eyes closed (or the character's equivalent); same size as base. Full frame. */
  blink: Sprite
  /** One "working" frame (sparkle, glint, hand raised, shake). Full frame. */
  work: Sprite
}

export type CastEntry = {
  id: CharacterId
  name: string
  /** Short epithet drawn under the name plate. */
  title: string
  /** Accent color for name plates, band chips, bubble borders. */
  accent: number
  mini: MiniSet
  /** Masters run the main session; Servants are summoned as subagents. */
  role: 'master' | 'servant'
  /** Servant class as announced at summoning ('Saber', 'Archer', ...). Servants only. */
  className?: string
  /** The Master this Servant answers to in the Heaven's Feel route, when that Master is in the cast. */
  master?: HeavensFeelMaster
}

const TRANSPARENT = '.'
const ERASE = '#'
export const OVERLAY_KEEP = TRANSPARENT
export const OVERLAY_ERASE = ERASE

const sprite = (rows: readonly string[], palette: Palette): Sprite => ({
  w: rows[0]?.length ?? 0,
  h: rows.length,
  rows,
  palette,
})

// ---------------------------------------------------------------------------
// Sakura Matou (main session) 24 x 32
// ---------------------------------------------------------------------------

export const SAKURA_PALETTE: Palette = {
  H: 0x8f73c2, // hair
  h: 0x5e4792, // hair shadow / edge
  L: 0xb9a2e4, // hair highlight
  R: 0xd8393f, // ribbon red
  r: 0x9b2229, // ribbon dark
  S: 0xf8e2cf, // skin
  s: 0xe6bda2, // skin shadow
  E: 0x6f45b0, // iris
  e: 0x2a1b3d, // eye dark / lashes / open mouth
  W: 0xffffff, // eye glint
  B: 0xf3a5b1, // blush
  M: 0xc26274, // mouth
  U: 0x8e6d49, // blazer
  u: 0x5f4631, // blazer shadow
  C: 0xf6f2ea, // collar / thought dots
  k: 0x3b3250, // skirt
  K: 0x4f4468, // skirt pleat
  O: 0x2a2030, // shoes
  w: 0xa6d8ff, // sweat drop
  o: 0xfff2a8, // sparkle
  Z: 0xdcd6f0, // sleep z
  X: 0xa81e2d, // dark-form dress pattern
  T: 0x2b0f2e, // dark-form shadow tendrils
}

/** Palette swap for the corrupted form: white hair, red eyes, black-and-red dress. */
export const DARK_SAKURA_PALETTE: Palette = {
  ...SAKURA_PALETTE,
  H: 0xe7e2f1,
  h: 0xb4abc9,
  L: 0xffffff,
  R: 0x1b1420,
  r: 0x120d16,
  S: 0xf4e9ea,
  s: 0xd7c3cb,
  E: 0xd62a3a,
  e: 0x160a12,
  W: 0xffd6d6,
  B: 0xd49ab5,
  M: 0x8a2a3d,
  U: 0x1d1620,
  u: 0x0e0a10,
  C: 0x8e1a2b,
  k: 0x1d1620,
  K: 0x7f1424,
  O: 0x100a12,
}

export const SAKURA_BASE: Sprite = sprite(
  [
    '........................',
    '........hhHHHHhh........',
    '......hHHLLHHHHHhRR.....',
    '.....hHLLHHHHHHHHRRRr...',
    '....hHHLHHHHHHHHHHrRRr..',
    '....hHHHHHHHHHHHHHHrRr..',
    '...hHHHHHHhHHHhHHHHHhr..',
    '...hHHHHHHHHHHHHHHHHh...',
    '..hHHHhSSHhHHhHSShHHHh..',
    '..hHHhSSSSSSSSSSSShHHHh.',
    '..hHHhSeeeSSSSeeeShHHHh.',
    '..hHHhSWEESSSSWEEShHHHh.',
    '.hHHHhSEEeSSSSEEeShHHHh.',
    '.hHHHhSBeeSSSSeeBShHHHh.',
    '.hHHHhsSSSSSSSSSSshHHHh.',
    '.hHHHhsSSSSMMSSSSshHHHh.',
    '.hHHHHhsSSSSSSSSshHHHHh.',
    '.hHHHHHhsSSSSSSshHHHHHh.',
    '.hHHHHHHhsSSSSshHHHHHHh.',
    '.hHHHHHhCCsSSsCChHHHHHh.',
    '.hHHHHhUCCCRRCCCUhHHHHh.',
    '.hHHHhUUUCCRRCCUUUhHHHh.',
    '.hHHhUUUUUURRUUUUUUhHHh.',
    '.hHHhUUUUUUuuUUUUUUhHHh.',
    '.hHHhuUUUUUuuUUUUUuhHHh.',
    '.hHHhuUUUUSSSSUUUUuhHHh.',
    '..hHhkkkkksSSskkkkkhHh..',
    '..hhkkkkkkkkkkkkkkkkhh..',
    '...kkkkkkkkkkkkkkkkkk...',
    '...kKkkKkkKkkKkkKkkKk...',
    '.......sSs....sSs.......',
    '.......OOO....OOO.......',
  ],
  SAKURA_PALETTE,
)

const blank24 = '........................'
const sakuraOverlay = (patch: Record<number, string>): Overlay =>
  sprite(
    Array.from({ length: 32 }, (_, y) => patch[y] ?? blank24),
    SAKURA_PALETTE,
  )

/** Eyes closed. */
export const SAKURA_BLINK: Overlay = sakuraOverlay({
  10: '.......SSS....SSS.......',
  11: '.......SSS....SSS.......',
  12: '.......eee....eee.......',
  13: '........SS....SS........',
})

/** Mouth open (talk). Combine with any eye overlay. */
export const SAKURA_TALK: Overlay = sakuraOverlay({
  15: '...........ee...........',
  16: '...........MM...........',
})

/** Happy: closed smiling eyes, bigger blush, U smile. */
export const SAKURA_HAPPY: Overlay = sakuraOverlay({
  10: '.......SSS....SSS.......',
  11: '.......SeS....SeS.......',
  12: '.......eSe....eSe.......',
  13: '......BBSS....SSBB......',
  14: '..........M..M..........',
  15: '...........MM...........',
})

/** Thinking: eyes glance up and to the side, flat mouth. Pair with THINK_DOTS frames. */
export const SAKURA_THINK: Overlay = sakuraOverlay({
  11: '.......WEe....WEe.......',
  12: '.......SEE....SEE.......',
  15: '...........Ms...........',
})

/** Three frames of thought dots drifting up-right of the head. */
export const SAKURA_THINK_DOTS: readonly Overlay[] = [
  sakuraOverlay({ 2: '....................C...' }),
  sakuraOverlay({ 2: '....................C...', 1: '......................C.' }),
  sakuraOverlay({
    2: '....................C...',
    1: '......................C.',
    0: '.......................C',
  }),
]

/** Ouch: X eyes, wobbly mouth, sweat drop. */
export const SAKURA_OUCH: Overlay = sakuraOverlay({
  9: '.......................w',
  10: '.......SSS....SSS......w',
  11: '.......eSe....eSe.......',
  12: '.......SeS....SeS.......',
  13: '.......eSe....eSe.......',
  15: '.........M.MM.M.........',
})

/** Sleeping: closed eyes + tiny mouth. Pair with SLEEP_Z frames. */
export const SAKURA_SLEEP: Overlay = sakuraOverlay({
  10: '.......SSS....SSS.......',
  11: '.......SSS....SSS.......',
  12: '.......eee....eee.......',
  13: '........SS....SS........',
  15: '...........Ms...........',
})

export const SAKURA_SLEEP_Z: readonly Overlay[] = [
  sakuraOverlay({ 5: '.....................Z..' }),
  sakuraOverlay({
    3: '.....................ZZ.',
    4: '......................Z.',
    5: '.....................ZZ.',
  }),
  sakuraOverlay({
    0: '.....................ZZZ',
    1: '......................Z.',
    2: '.....................ZZZ',
  }),
]

/** Searching: eyes look left, then right. Two frames. */
export const SAKURA_SEARCH: readonly Overlay[] = [
  sakuraOverlay({
    11: '.......EEW....EEW.......',
    12: '.......eES....eES.......',
  }),
  sakuraOverlay({
    11: '.......WEE....WEE.......',
    12: '.......SEe....SEe.......',
  }),
]

/** Editing: hands move up (typing). Frame 0 is the base (no overlay); frame 1 lifts the hands. */
export const SAKURA_EDIT: readonly Overlay[] = [
  sakuraOverlay({}),
  sakuraOverlay({
    24: '..........sSSs..........',
    25: '..........UUUU..........',
    26: '..........kkkk..........',
  }),
]

/** Running a shell: a sweat drop slides down. Two frames. */
export const SAKURA_RUN: readonly Overlay[] = [
  sakuraOverlay({
    9: '.......................w',
    10: '.......................w',
    15: '...........Ms...........',
  }),
  sakuraOverlay({
    10: '.......................w',
    11: '.......................w',
    15: '...........Ms...........',
  }),
]

/** Summoning a Servant (Agent tool): happy eyes + drifting sparkles. Two frames. */
export const SAKURA_SUMMON: readonly Overlay[] = [
  sakuraOverlay({
    5: '.o......................',
    9: '.......................o',
    10: '.......SSS....SSS.......',
    11: '.......SeS....SeS.......',
    12: '.......eSe....eSe.......',
    13: '........SS....SS........',
  }),
  sakuraOverlay({
    3: '..o.....................',
    7: '......................o.',
    12: 'o......eSe....eSe.......',
    10: '.......SSS....SSS.......',
    11: '.......SeS....SeS.......',
    13: '........SS....SS........',
  }),
]

/**
 * Dark Sakura: apply DARK_SAKURA_PALETTE to the base, then this overlay.
 * It removes the hair ribbon, adds the red zigzag on the dress and skirt, and
 * lets shadow tendrils creep in from the bottom corners.
 */
export const DARK_SAKURA_OVERLAY: Overlay = sprite(
  [
    blank24,
    blank24,
    '.................##.....',
    '.................H###...',
    '..................H###..',
    '...................###..',
    '.....................#..',
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    blank24,
    '.......X........X.......',
    '......X..X....X..X......',
    '.......X........X.......',
    '......X..X....X..X......',
    blank24,
    blank24,
    'T......................T',
    'T..X..X..X..X..X..X....T',
    'TT..X..X..X..X..X..X..TT',
    'TTT..................TTT',
    'TTTT................TTTT',
  ],
  DARK_SAKURA_PALETTE,
)

// ---------------------------------------------------------------------------
// Sakura HD 48 x 64 (docked pane with room; see DESIGN.md §2.1 and §8)
// Produced by the art pipeline (Codex image generation -> Pillow box downscale ->
// 32-colour median cut merged to 9 colours). Palette chars here are frequency-
// assigned by the converter, not semantic: H = outline, h = hair, L = hair shadow,
// R = skin, r = blazer, S/s = mid tones, E = ribbon red, e = highlights.
// ---------------------------------------------------------------------------

export const SAKURA_HD_PALETTE: Palette = {
  H: 0x2d1732,
  h: 0x5b336b,
  L: 0x4c3049,
  R: 0xfbe0c8,
  r: 0x875859,
  S: 0xbea393,
  s: 0x987882,
  E: 0x9e2020,
  e: 0xe8c8b4,
  X: 0xd62a3a, // dark-form iris (overlay only)
}

/** Dark form for the HD portrait: white hair, black blazer, dark ribbon; eyes via SAKURA_HD_DARK_EYES. */
export const SAKURA_HD_DARK_PALETTE: Palette = {
  H: 0x1a1220,
  h: 0xe7e2f1,
  L: 0xb4abc9,
  R: 0xf4e9ea,
  r: 0x1d1620,
  S: 0x6b5560,
  s: 0x3b2a36,
  E: 0x4a0c14,
  e: 0xf7f1f3,
  X: 0xd62a3a,
}

export const SAKURA_HD_BASE: Sprite = sprite(
  [
    '..................HHHHHLHHHH....................',
    '...............HHLLhhhhhhhLhLLH.................',
    '.............HLhhhhLhhhhhLhhhhhLH...............',
    '...........HHhhhhHHhhhhhhLHHhhhhhLH.............',
    '..........HLhhhLHhhhhhhhhhhhHLhhhhhH............',
    '.........HLhhhhLhhhhhhhhhhhhhHhhhhhLH...........',
    '........HLhshhhhhhhhhhhhhhhhhhLhhLhhL...........',
    '........LhsShLhhhhhhhhhhLhhhhhhLhsLhhH..........',
    '.......HhsSsLhhhhhhhhhhhLhhhhhhLhShLhhHHH.......',
    '......HhhsshLsShHhhhhhhhHLhhLhhhLshHhHEEEH......',
    '......HhhshhLhshHhhhhhhhHHhhLhhhLhhLhLEEEE......',
    '......hhhhhLhhhhHhhsshhhHLhhhHhhLhhhHHEEHEH.....',
    '.....HhhhhhHhhhLHhhsshhhHsLhhHhhhLhhHLEEHEEH....',
    '.....HhhhhhLhhhLhhhhhhLhLSrhhLHhhHhhLLEEHEEE....',
    '.....hLhhhhLhhhrrhhhhhLhhSeLhhHhhLhhLLEEEHEE....',
    '....HhLhhhhhhLLSshhhhhhLhSRShhLLhLhhLHEEEHEH....',
    '....HhLhhhhhhLLeSLhLhhhHhSsshHLLhLhhhHHHHEH.....',
    '....HhLhhhLhLhhSrHhLhhhHhSRRRrLSLLhhhHLEEEE.....',
    '....LhHhhhLhHLreRrhHhhhHLsRRRRrSeLhhhHLEEEE.....',
    '....hLHhhhLhLHSRReLHLhhLsrReSeeSeShhhHLLEHEH....',
    '....hLHhhhLHSLSReesHShhLeLesrHHHHrLhhHLHEEEE....',
    '....hLHhhhLHRsrssSesSShhSRSHHHhHLHHhhHHHEEEE....',
    '....hHHLhhhrsHHHHHrRRRShrRSrHhRLeLHhhrsHEEEEH...',
    '....LHHLhhhLHLsHHeheRRRReRRsLHhHRsLhhrRLH.HEE...',
    '....HH.HhhhHHeSHHrLSRRRRRRRshHhhReLhhrRrH.HEH...',
    '....HH.HhHhLseehhHhSRRRRRRRSsSssRSLhhsRLL.HH....',
    '.....H.HhHhhSRRhsssSRRRRRRRRssseRShhhSSHL.......',
    '.......HHHHhLRResssRRRRRRRRRRReeerhhhrLhL.......',
    '.......HhHHHHsRReeRRRRRRRRRRReeeeLhhhHhhL.......',
    '.......HhLLLHeeeeeRRRReSSeRRRRRRsLhhhHhhL.......',
    '.......hhLLhLLSeeRRRRRRRRRRRRRSLHLhLhHhhh.......',
    '.......hhLLhhHLrSeRRRRRRRRSSrLHHHhhLhHhhhH......',
    '......HhhHLhhHHHHLLLLrsSSsrHHHHHHhhHLHLhhH......',
    '......HhhHHhhHHHHHHLrsRsseeLLHHHHhhLLHLhhL......',
    '......hhhHLhhHHHHHrrrseLrSeLrrHHHhLhLHLhhhH.....',
    '.....HhhhHLshHHHHLrLrLEEEELrLrLHHhHhLHHhhhH.....',
    '.....hhLhHhshLHHHLrrLLEEEEELLrLHhLLshHHhhhhH....',
    '....HhLhLHhshLHHHHrrLrHErErHrrLHhHhshHHhhHhL....',
    '....LhHhLHhhhLHHHHrrrHLrSLLLrrHHhHhhhHHhhHhhH...',
    '...HhLHhHHLhhLLHHHLrrLLrrrLrrrHHHhhLLHHLhHLhL...',
    '...LhHLhHHLLhhHHHHLrrrLLHLLrrLHHHhhHLHHLhLHhh...',
    '..HhLHhhHHHHhhHHHHHrrrHrLHrrrHHHLhHHHHHLhH.LhH..',
    '..HhH.hhHHHHHhLHHLLrrrLrLLrrrLHHhLHHHHHLhH.HhH..',
    '..HhH.hhHHHHHHLHHrrLrrrLHrrrLrrHHHHHHHHHhH..hH..',
    '..HL..LhHHHHHHHHHrrHrrsrLSrrHrrHHHHHHHHHhH..LH..',
    '..HL..HhHHHHHHHHLHHHsSsssSSSHHHHHHHHHHHHhH..LH..',
    '...H..HhHH.HHHHHLHLHHSRRSRSHHLLLHHHHH.HHL...H...',
    '...H...hLH.HHHHLLHLLHrReSerHLLHLLHHHH.HLL...H...',
    '...HH..HLH..HHHLHLLLHLLLLLLHLLHLLHHH..HL...H....',
    '........HH..HH.HHLLHLLLHLLLLLLLHH.H...HH........',
    '.........HH.....SSsHLLHHHHLLrsSs.....H..........',
    '................SReeer....reeeRS................',
    '...............HRRRRRH....LRRRRRH...............',
    '...............HLsRRS......SRRsLH...............',
    '..............HHHHHHH......HHHHHH...............',
    '..............HHHHHHH......HHHHHHH..............',
    '..............HHHHHH........HHHHHH..............',
    '..............HHHHHH........HHHHHH..............',
    '..............HHLLLH........HLLHHH..............',
    '.............HLHHHHHH......HHHHHHLH.............',
    '.............HLHHLLLH......HrLLHHLH.............',
    '.............HLLLLLHLH....HLLHHLLLH.............',
    '.............HHLLLLLLH....HLLLLLLHH.............',
    '...............HHHHHH......HHHHHH...............',
  ],
  SAKURA_HD_PALETTE,
)

const blank48 = '................................................'
const hdOverlay = (patch: Record<number, string>, palette: Palette = SAKURA_HD_PALETTE): Overlay =>
  sprite(
    Array.from({ length: 64 }, (_, y) => patch[y] ?? blank48),
    palette,
  )

/** Dark form: red irises (left iris rows 23–25 cols 15–17, right iris rows 22–24 cols 28–31). */
export const SAKURA_HD_DARK_EYES: Overlay = hdOverlay(
  {
    22: '............................XX..................',
    23: '...............XX............XXX................',
    24: '...............XX............XXX................',
    25: '...............XXX..............................',
  },
  SAKURA_HD_DARK_PALETTE,
)

/**
 * Eyes closed for the HD portrait. Extracted by the pipeline's masked diff (DESIGN.md §8.2 step 4)
 * from a Codex `-i` variant of this exact base: both images bbox-cropped, box-downscaled to 48x64,
 * snapped to SAKURA_HD_PALETTE, diffed inside the eye band (rows 19–28, cols 9–38).
 */
export const SAKURA_HD_BLINK: Overlay = hdOverlay({
  19: '.................R.......h.RRRReR.L.............',
  20: '................RRS.......RRRRRRReH.............',
  21: '..........h...eRRRR...L...RRRRRRRRL.............',
  22: '............RRRRRRR.......eSeeeRRRL...S.........',
  23: '...........rRRRReSS...........H.H.h.............',
  24: '...........LRSrL.HsR......SHLssrHLh.............',
  25: '.............HHrssrs......eRRRRRe...............',
  26: '............sreRRRRR........RRRR................',
  27: '...............RRRR..............s..............',
  28: '................RR..............................',
})

export const SAKURA_HD = {
  base: SAKURA_HD_BASE,
  blink: SAKURA_HD_BLINK,
  darkEyes: SAKURA_HD_DARK_EYES,
  darkPalette: SAKURA_HD_DARK_PALETTE,
} as const

// ---------------------------------------------------------------------------
// Mini sprites 12 x 12 (subagents and the roster / band)
// ---------------------------------------------------------------------------

const SAKURA_MINI_BASE: Sprite = sprite(
  [
    '....hhhh....',
    '..hHHHHHhR..',
    '.hHLHHHHHhRr',
    '.hHHHHHHHHr.',
    '.hHhSShHhHh.',
    'hHSeSSSSeSHh',
    'hHSESSSSESHh',
    'hHsSSSSSSsHh',
    'hHHsSMMSsHHh',
    'hHHCsSSsCHHh',
    '.hHUURRUUHh.',
    '.hhUUUUUUhh.',
  ],
  SAKURA_PALETTE,
)

const SAKURA_MINI: MiniSet = {
  base: SAKURA_MINI_BASE,
  blink: sprite(
    [
      '....hhhh....',
      '..hHHHHHhR..',
      '.hHLHHHHHhRr',
      '.hHHHHHHHHr.',
      '.hHhSShHhHh.',
      'hHSSSSSSSSHh',
      'hHSeSSSSeSHh',
      'hHsSSSSSSsHh',
      'hHHsSMMSsHHh',
      'hHHCsSSsCHHh',
      '.hHUURRUUHh.',
      '.hhUUUUUUhh.',
    ],
    SAKURA_PALETTE,
  ),
  work: sprite(
    [
      '....hhhh...o',
      '..hHHHHHhR..',
      'ohHLHHHHHhRr',
      '.hHHHHHHHHr.',
      '.hHhSShHhHh.',
      'hHSeSSSSeSHh',
      'hHSESSSSESHh',
      'hHsSSSSSSsHh',
      'hHHsSMMSsHHh',
      'hHHCsSSsCHHh',
      '.hHUURRUUHh.',
      '.hhUUUUUUhh.',
    ],
    SAKURA_PALETTE,
  ),
}

/** Dark Sakura mini: same rows as SAKURA_MINI with the dark palette (ribbon reads black). */
export const DARK_SAKURA_MINI: MiniSet = {
  base: { ...SAKURA_MINI.base, palette: DARK_SAKURA_PALETTE },
  blink: { ...SAKURA_MINI.blink, palette: DARK_SAKURA_PALETTE },
  work: { ...SAKURA_MINI.work, palette: DARK_SAKURA_PALETTE },
}

// Rider (Medusa): waist-length lavender hair, blindfold, black bodysuit.
const RIDER_PALETTE: Palette = {
  P: 0xb9a3d9,
  p: 0x8a74ad,
  V: 0x3a2a5e,
  S: 0xf6e6dc,
  s: 0xdcc2b4,
  M: 0xa85a6a,
  U: 0x1a1a24,
  W: 0xffffff,
}
const RIDER_MINI: MiniSet = {
  base: sprite(
    [
      '....pppp....',
      '..pPPPPPPp..',
      '.pPPPPPPPPp.',
      '.pPPPPPPPPp.',
      '.pPpSSSSpPp.',
      'pPPVVVVVVPPp',
      'pPPVVVVVVPPp',
      'pPPsSSSSsPPp',
      'pPPsSSMSsPPp',
      'pPPUsSSsUPPp',
      'pPPUUUUUUPPp',
      'pppUUUUUUppp',
    ],
    RIDER_PALETTE,
  ),
  // Blindfolded: her "blink" is the mouth relaxing.
  blink: sprite(
    [
      '....pppp....',
      '..pPPPPPPp..',
      '.pPPPPPPPPp.',
      '.pPPPPPPPPp.',
      '.pPpSSSSpPp.',
      'pPPVVVVVVPPp',
      'pPPVVVVVVPPp',
      'pPPsSSSSsPPp',
      'pPPsSSSSsPPp',
      'pPPUsSSsUPPp',
      'pPPUUUUUUPPp',
      'pppUUUUUUppp',
    ],
    RIDER_PALETTE,
  ),
  // Mystic Eyes glint through the blindfold; hair tips sway.
  work: sprite(
    [
      '....pppp....',
      '..pPPPPPPp..',
      '.pPPPPPPPPp.',
      '.pPPPPPPPPp.',
      '.pPpSSSSpPp.',
      'pPPVWVVVWVPp',
      'pPPVVVVVVPPp',
      'pPPsSSSSsPPp',
      'pPPsSSMSsPPp',
      'pPPUsSSsUPPp',
      'pPPUUUUUUPPp',
      'pp.UUUUUU.pp',
    ],
    RIDER_PALETTE,
  ),
}

// Rin Tohsaka: black twin-tails, aqua eyes, red top, white collar.
const RIN_PALETTE: Palette = {
  H: 0x1f1a2a,
  h: 0x0f0c14,
  L: 0x3d3550,
  S: 0xf8e2cf,
  s: 0xe6bda2,
  E: 0x3fa9c9,
  e: 0x14202a,
  M: 0xc26274,
  C: 0xf6f2ea,
  R: 0xc8302f,
  r: 0x8f1f1f,
  o: 0xfff2a8,
}
const RIN_MINI: MiniSet = {
  base: sprite(
    [
      '....hhhh....',
      '..hHHHHHHh..',
      '.hHHLHHHHHh.',
      'hHHHHHHHHHHh',
      'hHHhSSSShHHh',
      'hHHSeSSeSHHh',
      'hHHSESSESHHh',
      'hHHsSSSSsHHh',
      'hHHsSMMSsHHh',
      'hHhCsSSsChHh',
      'hH.RRRRRR.Hh',
      'hh.RrRRrR.hh',
    ],
    RIN_PALETTE,
  ),
  blink: sprite(
    [
      '....hhhh....',
      '..hHHHHHHh..',
      '.hHHLHHHHHh.',
      'hHHHHHHHHHHh',
      'hHHhSSSShHHh',
      'hHHSSSSSSHHh',
      'hHHSeSSeSHHh',
      'hHHsSSSSsHHh',
      'hHHsSMMSsHHh',
      'hHhCsSSsChHh',
      'hH.RRRRRR.Hh',
      'hh.RrRRrR.hh',
    ],
    RIN_PALETTE,
  ),
  // A gem held up, catching the light.
  work: sprite(
    [
      '....hhhh....',
      '..hHHHHHHh..',
      '.hHHLHHHHHh.',
      'hHHHHHHHHHHh',
      'hHHhSSSShHHh',
      'hHHSeSSeSHHh',
      'hHHSESSESHHh',
      'hHHsSSSSsHHh',
      'hHHsSMMSsHHh',
      'hHhCsSSsChHh',
      'hH.RRRRRRoHh',
      'hh.RrRRrRSh.',
    ],
    RIN_PALETTE,
  ),
}

// Shirou Emiya: red-orange spiky hair, amber eyes, blue-and-white shirt.
const SHIROU_PALETTE: Palette = {
  H: 0xd9622b,
  h: 0x9c3f17,
  L: 0xf0884a,
  S: 0xf6dcc4,
  s: 0xe0b394,
  E: 0xc98b2a,
  e: 0x2a1a10,
  M: 0xb8605a,
  C: 0xf6f2ea,
  U: 0x2f4f8a,
  o: 0x9fd8ff,
}
const SHIROU_MINI: MiniSet = {
  base: sprite(
    [
      '.h..hh..h...',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHLHHHHHh.',
      '.hHhSSSSSHh.',
      '..hSeSSeSSh.',
      '..hSESSESSh.',
      '..hsSSSSSsh.',
      '...sSSMSs...',
      '..UCCsSsCCU.',
      '.UUUCCCCCUUU',
      '.UUUUCCCUUUU',
    ],
    SHIROU_PALETTE,
  ),
  blink: sprite(
    [
      '.h..hh..h...',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHLHHHHHh.',
      '.hHhSSSSSHh.',
      '..hSSSSSSSh.',
      '..hSeSSeSSh.',
      '..hsSSSSSsh.',
      '...sSSMSs...',
      '..UCCsSsCCU.',
      '.UUUCCCCCUUU',
      '.UUUUCCCUUUU',
    ],
    SHIROU_PALETTE,
  ),
  // "Trace, on": blue-white sparks at his hands.
  work: sprite(
    [
      '.h..hh..h...',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHLHHHHHh.',
      '.hHhSSSSSHh.',
      '..hSeSSeSSh.',
      '..hSESSESSh.',
      '..hsSSSSSsh.',
      '...sSSMSs..o',
      'o.UCCsSsCCU.',
      '.UUUCCCCCUUU',
      'oUUUUCCCUUUo',
    ],
    SHIROU_PALETTE,
  ),
}

// Kotomine Kirei: black hair, cassock with a gold cross, faint smile.
const KIREI_PALETTE: Palette = {
  H: 0x1c1a22,
  h: 0x0b0a0e,
  S: 0xf1d9c2,
  s: 0xd8b597,
  E: 0x6b4a2e,
  e: 0x1a120c,
  M: 0x9a5a5a,
  C: 0xe9e4da,
  U: 0x15131a,
  G: 0xd7b24a,
}
const KIREI_MINI: MiniSet = {
  base: sprite(
    [
      '...hhhhhh...',
      '..hHHHHHHh..',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHSSSSSSHh.',
      '.hSSeSSeSSh.',
      '.hSSESSESSh.',
      '.hsSSSSSSsh.',
      '..sSSMMSSs..',
      '..UUCsSCUU..',
      '.UUUGGGGUUU.',
      '.UUUUGGUUUU.',
    ],
    KIREI_PALETTE,
  ),
  blink: sprite(
    [
      '...hhhhhh...',
      '..hHHHHHHh..',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHSSSSSSHh.',
      '.hSSSSSSSSh.',
      '.hSSeSSeSSh.',
      '.hsSSSSSSsh.',
      '..sSSMMSSs..',
      '..UUCsSCUU..',
      '.UUUGGGGUUU.',
      '.UUUUGGUUUU.',
    ],
    KIREI_PALETTE,
  ),
  // One hand raised, as if making a point.
  work: sprite(
    [
      '...hhhhhh...',
      '..hHHHHHHh..',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHSSSSSSHh.',
      '.hSSeSSeSSh.',
      '.hSSESSESSh.',
      '.hsSSSSSSsh.',
      '..sSSMMSSsS.',
      '..UUCsSCUUS.',
      '.UUUGGGGUUU.',
      '.UUUUGGUUUU.',
    ],
    KIREI_PALETTE,
  ),
}

// Archer: white spiky hair, tan skin, red coat over black.
const ARCHER_PALETTE: Palette = {
  H: 0xe9e9ee,
  h: 0xa9a9b5,
  S: 0xb97a4a,
  s: 0x8a5530,
  E: 0x6a7a85,
  e: 0x1a1a1e,
  M: 0x5a2a22,
  R: 0xb3252a,
  U: 0x1a1a1e,
  W: 0xffffff,
}
const ARCHER_MINI: MiniSet = {
  base: sprite(
    [
      '..h..hh..h..',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHhSSSShHh.',
      '..hSeSSeSh..',
      '..hSESSESh..',
      '..hsSSSSsh..',
      '...sSMMSs...',
      '.RRRUsSsURRR',
      'RRRRUUUURRRR',
      'RRRRUUUURRRR',
    ],
    ARCHER_PALETTE,
  ),
  blink: sprite(
    [
      '..h..hh..h..',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHhSSSShHh.',
      '..hSSSSSSh..',
      '..hSeSSeSh..',
      '..hsSSSSsh..',
      '...sSMMSs...',
      '.RRRUsSsURRR',
      'RRRRUUUURRRR',
      'RRRRUUUURRRR',
    ],
    ARCHER_PALETTE,
  ),
  // A projected blade flickers into being at his side.
  work: sprite(
    [
      '..h..hh..h..',
      '.hHhHHHHhHh.',
      '.hHHHHHHHHh.',
      '.hHHHHHHHHh.',
      '.hHhSSSShHh.',
      '..hSeSSeSh..',
      '..hSESSESh..',
      'W.hsSSSSsh..',
      'W..sSMMSs...',
      'WRRRUsSsURRR',
      'RRRRUUUURRRR',
      'RRRRUUUURRRR',
    ],
    ARCHER_PALETTE,
  ),
}

// Saber Alter: pale blonde hair with a bun, black visor, black armor with red seams.
const SABER_ALTER_PALETTE: Palette = {
  H: 0xe6dcb8,
  h: 0xb3a884,
  S: 0xf4ece6,
  s: 0xd9ccc4,
  V: 0x14121a,
  E: 0xf2d13a,
  M: 0x7a3a44,
  U: 0x1a161f,
  R: 0x8a1a22,
  T: 0x3a0f2e,
}
const SABER_ALTER_MINI: MiniSet = {
  base: sprite(
    [
      '....hhhh....',
      '..hHHHHHHh..',
      '.hHHHHHHHHhh',
      '.hHHHHHHHHHh',
      '.hHhSSSShHh.',
      '..VVVVVVVV..',
      '..VVEVVEVV..',
      '..sSSSSSSs..',
      '...sSMMSs...',
      '..UUUsSUUU..',
      '.UURUUUUURUU',
      '.UUUURRUUUU.',
    ],
    SABER_ALTER_PALETTE,
  ),
  // The glow behind the visor goes out for a moment.
  blink: sprite(
    [
      '....hhhh....',
      '..hHHHHHHh..',
      '.hHHHHHHHHhh',
      '.hHHHHHHHHHh',
      '.hHhSSSShHh.',
      '..VVVVVVVV..',
      '..VVVVVVVV..',
      '..sSSSSSSs..',
      '...sSMMSs...',
      '..UUUsSUUU..',
      '.UURUUUUURUU',
      '.UUUURRUUUU.',
    ],
    SABER_ALTER_PALETTE,
  ),
  // Dark prana leaks off her.
  work: sprite(
    [
      '....hhhh...T',
      '..hHHHHHHh..',
      'ThHHHHHHHHhh',
      '.hHHHHHHHHHh',
      '.hHhSSSShHhT',
      '..VVVVVVVV..',
      'T.VVEVVEVV..',
      '..sSSSSSSs..',
      '...sSMMSs..T',
      'T.UUUsSUUU..',
      '.UURUUUUURUU',
      '.UUUURRUUUU.',
    ],
    SABER_ALTER_PALETTE,
  ),
}

// Illyasviel: silver hair, purple hat with white fur band, red eyes, purple coat.
const ILLYA_PALETTE: Palette = {
  H: 0xf0eef5,
  h: 0xbcb8cc,
  P: 0x5a3a8a,
  p: 0x3a2460,
  C: 0xf8f6ff,
  S: 0xfaeee6,
  s: 0xe4cfc4,
  E: 0xd0303a,
  e: 0x2a0a10,
  M: 0xc26274,
  o: 0xffffff,
}
const ILLYA_MINI: MiniSet = {
  base: sprite(
    [
      '..pPPPPPPp..',
      '.pPPPPPPPPp.',
      '.CCCCCCCCCC.',
      'hHHHHHHHHHHh',
      'hHhSSSSSShHh',
      'hHSeSSSSeSHh',
      'hHSESSSSESHh',
      'hHsSSSSSSsHh',
      'hHHsSMMSsHHh',
      'hHHPpSSpPHHh',
      'hHPPPPPPPPHh',
      'hhPPPPPPPPhh',
    ],
    ILLYA_PALETTE,
  ),
  blink: sprite(
    [
      '..pPPPPPPp..',
      '.pPPPPPPPPp.',
      '.CCCCCCCCCC.',
      'hHHHHHHHHHHh',
      'hHhSSSSSShHh',
      'hHSSSSSSSSHh',
      'hHSeSSSSeSHh',
      'hHsSSSSSSsHh',
      'hHHsSMMSsHHh',
      'hHHPpSSpPHHh',
      'hHPPPPPPPPHh',
      'hhPPPPPPPPhh',
    ],
    ILLYA_PALETTE,
  ),
  // Snow sparkles around her.
  work: sprite(
    [
      'o.pPPPPPPp.o',
      '.pPPPPPPPPp.',
      'oCCCCCCCCCC.',
      'hHHHHHHHHHHh',
      'hHhSSSSSShHh',
      'hHSeSSSSeSHh',
      'hHSESSSSESHh',
      'hHsSSSSSSsHh',
      'hHHsSMMSsHHh',
      'hHHPpSSpPHHh',
      'hHPPPPPPPPHh',
      'hhPPPPPPPPhh',
    ],
    ILLYA_PALETTE,
  ),
}

// True Assassin: black hood, white skull mask, grey wraps.
const TRUE_ASSASSIN_PALETTE: Palette = {
  U: 0x15121a,
  u: 0x070609,
  C: 0xf2f2ee,
  e: 0x000000,
  K: 0x2a2730,
  W: 0xd9f0ff,
}
const TRUE_ASSASSIN_MINI: MiniSet = {
  base: sprite(
    [
      '....uuuu....',
      '..uUUUUUUu..',
      '.uUUUUUUUUu.',
      '.uUUCCCCUUu.',
      '.uUCCCCCCUu.',
      '.uUCeCCeCUu.',
      '.uUCeCCeCUu.',
      '.uUCCCCCCUu.',
      '..uUCCCCUu..',
      '..KKKUUKKK..',
      '.KKKKKKKKKK.',
      '.KKKKKKKKKK.',
    ],
    TRUE_ASSASSIN_PALETTE,
  ),
  // A skull does not blink; the eye holes narrow instead.
  blink: sprite(
    [
      '....uuuu....',
      '..uUUUUUUu..',
      '.uUUUUUUUUu.',
      '.uUUCCCCUUu.',
      '.uUCCCCCCUu.',
      '.uUCCCCCCUu.',
      '.uUCeCCeCUu.',
      '.uUCCCCCCUu.',
      '..uUCCCCUu..',
      '..KKKUUKKK..',
      '.KKKKKKKKKK.',
      '.KKKKKKKKKK.',
    ],
    TRUE_ASSASSIN_PALETTE,
  ),
  // A dirk glints at his hip.
  work: sprite(
    [
      '....uuuu....',
      '..uUUUUUUu..',
      '.uUUUUUUUUu.',
      '.uUUCCCCUUu.',
      '.uUCCCCCCUu.',
      '.uUCeCCeCUu.',
      '.uUCeCCeCUu.',
      '.uUCCCCCCUu.',
      '..uUCCCCUu..',
      '..KKKUUKKK.W',
      '.KKKKKKKKKKW',
      '.KKKKKKKKKK.',
    ],
    TRUE_ASSASSIN_PALETTE,
  ),
}

// Berserker: grey skin, wild dark hair, red eyes, stone blade at his side.
const BERSERKER_PALETTE: Palette = {
  H: 0x24242c,
  h: 0x121218,
  S: 0x5a5a66,
  s: 0x3c3c48,
  E: 0xe03030,
  e: 0x0a0a0c,
  M: 0x2a2a30,
  A: 0x9a9a8a,
}
const BERSERKER_MINI: MiniSet = {
  base: sprite(
    [
      '.hhh.hh.hhh.',
      'hHHHHHHHHHHh',
      'hHHHHHHHHHHh',
      'hHhSSSSSShHh',
      'hHSeeSSeeSHh',
      'hHSSESSESSHh',
      '.hsSSSSSSshA',
      '..sSSMMSSs.A',
      '.sSSsSSsSSsA',
      'sSSSSSSSSSSA',
      'sSSSSSSSSSSA',
      'ssSSSSSSSSsA',
    ],
    BERSERKER_PALETTE,
  ),
  blink: sprite(
    [
      '.hhh.hh.hhh.',
      'hHHHHHHHHHHh',
      'hHHHHHHHHHHh',
      'hHhSSSSSShHh',
      'hHSeeSSeeSHh',
      'hHSSeSSeSSHh',
      '.hsSSSSSSshA',
      '..sSSMMSSs.A',
      '.sSSsSSsSSsA',
      'sSSSSSSSSSSA',
      'sSSSSSSSSSSA',
      'ssSSSSSSSSsA',
    ],
    BERSERKER_PALETTE,
  ),
  // The whole frame shakes one pixel to the right.
  work: sprite(
    [
      '..hhh.hh.hhh',
      '.hHHHHHHHHHH',
      '.hHHHHHHHHHH',
      '.hHhSSSSSShH',
      '.hHSeeSSeeSH',
      '.hHSSESSESSH',
      '..hsSSSSSSsh',
      '...sSSMMSSs.',
      '..sSSsSSsSSs',
      '.sSSSSSSSSSS',
      '.sSSSSSSSSSS',
      '.ssSSSSSSSSs',
    ],
    BERSERKER_PALETTE,
  ),
}

// Saber (Artoria): gold-blonde braided bun with an ahoge, green eyes, blue dress, silver collar.
const SABER_PALETTE: Palette = {
  H: 0xf2dc86,
  h: 0xb89c48,
  L: 0xfff4c0,
  S: 0xfaeadf,
  s: 0xe2c8b8,
  E: 0x3cae5c,
  e: 0x1a2a1c,
  M: 0xc06878,
  U: 0x2a4ea8,
  u: 0x1a3478,
  A: 0xcdd2de,
  W: 0xffffff,
  o: 0xd4f6ea,
}
const SABER_MINI: MiniSet = {
  base: sprite(
    [
      '.....L......',
      '....hHHh....',
      '..hHHHHHHhh.',
      '.hHHHHHHHHHh',
      '.hHhSSSShHHh',
      '.hSeSSSSeShh',
      '.hSESSSSESh.',
      '..sSSSSSSs..',
      '...sSMMSs...',
      '..AAAsSAAA..',
      '.UUAUUUUAUU.',
      '.UUUUuuUUUU.',
    ],
    SABER_PALETTE,
  ),
  blink: sprite(
    [
      '.....L......',
      '....hHHh....',
      '..hHHHHHHhh.',
      '.hHHHHHHHHHh',
      '.hHhSSSShHHh',
      '.hSSSSSSSShh',
      '.hSeSSSSeSh.',
      '..sSSSSSSs..',
      '...sSMMSs...',
      '..AAAsSAAA..',
      '.UUAUUUUAUU.',
      '.UUUUuuUUUU.',
    ],
    SABER_PALETTE,
  ),
  // Invisible Air: the hidden blade catches the light at her side, wind curls off it.
  work: sprite(
    [
      '.....L.....W',
      '....hHHh...W',
      '..hHHHHHHhhW',
      '.hHHHHHHHHHh',
      'ohHhSSSShHHh',
      '.hSeSSSSeShh',
      'ohSESSSSESho',
      '..sSSSSSSs..',
      '...sSMMSs..o',
      '..AAAsSAAA..',
      '.UUAUUUUAUU.',
      '.UUUUuuUUUU.',
    ],
    SABER_PALETTE,
  ),
}

// Lancer (Cu Chulainn): slicked-back blue hair in a long ponytail, red eyes, sharp grin, dark bodysuit.
const LANCER_PALETTE: Palette = {
  H: 0x2c52d8,
  h: 0x1a308c,
  L: 0x5c82ff,
  S: 0xecc9a6,
  s: 0xcaa07c,
  E: 0xd62a2a,
  e: 0x1a1016,
  M: 0x7a2a30,
  W: 0xffffff,
  U: 0x1c2a6a,
  u: 0x10183f,
  A: 0xc8d0dc,
  R: 0xe03030,
  r: 0x8a1a1a,
}
const LANCER_MINI: MiniSet = {
  base: sprite(
    [
      '...hhhhh....',
      '..hHHHHHh...',
      '.hHHHLHHHh..',
      '.hHSShSSHHh.',
      '.hSSSSSSSHHh',
      '.hSeSSSeSsHh',
      '.hSESSSESAHh',
      '..sSSSSSs.Hh',
      '...sMWMs..Hh',
      '..UUsSsUU..h',
      '.UUUUUUUUU..',
      '.UuUUUUUuU..',
    ],
    LANCER_PALETTE,
  ),
  blink: sprite(
    [
      '...hhhhh....',
      '..hHHHHHh...',
      '.hHHHLHHHh..',
      '.hHSShSSHHh.',
      '.hSSSSSSSHHh',
      '.hSSSSSSSsHh',
      '.hSeSSSeSAHh',
      '..sSSSSSs.Hh',
      '...sMWMs..Hh',
      '..UUsSsUU..h',
      '.UUUUUUUUU..',
      '.UuUUUUUuU..',
    ],
    LANCER_PALETTE,
  ),
  // Gae Bolg's tip rises at his left, the barb catching a glint.
  work: sprite(
    [
      'W..hhhhh....',
      'R.hHHHHHh...',
      'RhHHHLHHHh..',
      'rhHSShSSHHh.',
      '.hSSSSSSSHHh',
      '.hSeSSSeSsHh',
      '.hSESSSESAHh',
      '..sSSSSSs.Hh',
      '...sMWMs..Hh',
      '..UUsSsUU..h',
      '.UUUUUUUUU..',
      '.UuUUUUUuU..',
    ],
    LANCER_PALETTE,
  ),
}

// Caster (Medea): a pointed violet hood shadows the upper face; pale chin, violet lips, flowing robe.
const CASTER_PALETTE: Palette = {
  P: 0x4a2a7e,
  p: 0x2a1449,
  L: 0x6c4aa0,
  D: 0x1a0c2c,
  V: 0x9a6ad0,
  S: 0xf5eef6,
  s: 0xddd0e2,
  M: 0x9c48b4,
  U: 0x3a2068,
  G: 0xd8a8ff,
  W: 0xffffff,
}
const CASTER_MINI: MiniSet = {
  base: sprite(
    [
      '.....pp.....',
      '....pPPp....',
      '...pPPLPp...',
      '..pPPPPPPp..',
      '.pPPDDDDPPp.',
      '.pPDDDDDDPp.',
      '.pPDVDDVDPp.',
      '.pPDSSSSDPp.',
      '.pPDSMMSDPp.',
      '.pPPPsSPPPp.',
      '.PPUUUUUUPP.',
      'pPPUUUUUUPPp',
    ],
    CASTER_PALETTE,
  ),
  // The two points of light under the hood go out.
  blink: sprite(
    [
      '.....pp.....',
      '....pPPp....',
      '...pPPLPp...',
      '..pPPPPPPp..',
      '.pPPDDDDPPp.',
      '.pPDDDDDDPp.',
      '.pPDDDDDDPp.',
      '.pPDSSSSDPp.',
      '.pPDSMMSDPp.',
      '.pPPPsSPPPp.',
      '.PPUUUUUUPP.',
      'pPPUUUUUUPPp',
    ],
    CASTER_PALETTE,
  ),
  // A small sigil lights beside her raised hand.
  work: sprite(
    [
      '.....pp.....',
      '....pPPp....',
      '...pPPLPp...',
      '..pPPPPPPp..',
      '.pPPDDDDPPp.',
      '.pPDDDDDDPp.',
      '.pPDVDDVDPp.',
      '.pPDSSSSDPpG',
      '.pPDSMMSDPGW',
      '.pPPPsSPPPpG',
      '.PPUUUUUUPP.',
      'pPPUUUUUUPPp',
    ],
    CASTER_PALETTE,
  ),
}

// Assassin (Sasaki Kojiro): long indigo hair in a high ponytail, calm eyes, purple-and-cream haori.
const ASSASSIN_PALETTE: Palette = {
  H: 0x3c3c90,
  h: 0x24245e,
  L: 0x5e5eb8,
  S: 0xf6e6da,
  s: 0xdec6b6,
  E: 0x5a6a9c,
  e: 0x1c1c30,
  M: 0xa46878,
  P: 0x6c4aa2,
  p: 0x4a3072,
  C: 0xf6eedc,
  W: 0xffffff,
}
const ASSASSIN_MINI: MiniSet = {
  base: sprite(
    [
      '...hHh......',
      '..hHHHHHh...',
      '.hHHHHHHHHh.',
      'hHHHHHHHHHHh',
      'hHhSSHSSShH.',
      'hHSeSSSSeSh.',
      'hHSESSSSESh.',
      'hHsSSSSSSs..',
      'hH.sSMMSs...',
      'hH.PPsSsPP..',
      'hLPPCCCCCPP.',
      '.hPpCCCCCpP.',
    ],
    ASSASSIN_PALETTE,
  ),
  blink: sprite(
    [
      '...hHh......',
      '..hHHHHHh...',
      '.hHHHHHHHHh.',
      'hHHHHHHHHHHh',
      'hHhSSHSSShH.',
      'hHSSSSSSSSh.',
      'hHSeSSSSeSh.',
      'hHsSSSSSSs..',
      'hH.sSMMSs...',
      'hH.PPsSsPP..',
      'hLPPCCCCCPP.',
      '.hPpCCCCCpP.',
    ],
    ASSASSIN_PALETTE,
  ),
  // Monohoshizao: a hair-thin line of steel stands at his side.
  work: sprite(
    [
      '...hHh......',
      '..hHHHHHh...',
      '.hHHHHHHHHh.',
      'hHHHHHHHHHHW',
      'hHhSSHSSShHW',
      'hHSeSSSSeShW',
      'hHSESSSSEShW',
      'hHsSSSSSSs.W',
      'hH.sSMMSs..W',
      'hH.PPsSsPP.W',
      'hLPPCCCCCPPW',
      '.hPpCCCCCpP.',
    ],
    ASSASSIN_PALETTE,
  ),
}

// Gilgamesh: spiky upswept gold hair, red eyes, a smirk, gold armor collar.
const GILGAMESH_PALETTE: Palette = {
  H: 0xeec22c,
  h: 0xb48c16,
  L: 0xfff0a0,
  S: 0xf6dece,
  s: 0xdebaa0,
  E: 0xd82a2a,
  e: 0x1a0c0c,
  M: 0x9a4040,
  G: 0xe6b62e,
  g: 0xa07616,
  o: 0xfff2a8,
  W: 0xffffff,
}
const GILGAMESH_MINI: MiniSet = {
  base: sprite(
    [
      '..H..H.H.HH.',
      '.hHhhHhHhHHh',
      '.hHHHHHHHHHh',
      '.hHHHHLHHHHh',
      '.hHSSSSSSHh.',
      '.hSeSSSSeSh.',
      '.hSESSSSESh.',
      '..sSSSSSSs..',
      '...sSSSMMs..',
      '..GGgsSgGG..',
      '.GGGGgGgGGGG',
      '.GGGGGGGGGG.',
    ],
    GILGAMESH_PALETTE,
  ),
  blink: sprite(
    [
      '..H..H.H.HH.',
      '.hHhhHhHhHHh',
      '.hHHHHHHHHHh',
      '.hHHHHLHHHHh',
      '.hHSSSSSSHh.',
      '.hSSSSSSSSh.',
      '.hSeSSSSeSh.',
      '..sSSSSSSs..',
      '...sSSSMMs..',
      '..GGgsSgGG..',
      '.GGGGgGgGGGG',
      '.GGGGGGGGGG.',
    ],
    GILGAMESH_PALETTE,
  ),
  // The Gate of Babylon ripples open behind him: golden sparks ring the frame.
  work: sprite(
    [
      'o.H..H.H.HH.',
      '.hHhhHhHhHHh',
      '.hHHHHHHHHHo',
      'ohHHHHLHHHHh',
      '.hHSSSSSSHh.',
      '.hSeSSSSeShW',
      'ohSESSSSESh.',
      '..sSSSSSSs.o',
      'W..sSSSMMs..',
      '..GGgsSgGG..',
      'oGGGGgGgGGGG',
      '.GGGGGGGGGGo',
    ],
    GILGAMESH_PALETTE,
  ),
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CAST: Readonly<Record<CharacterId, CastEntry>> = {
  // Masters
  sakura: {
    id: 'sakura',
    name: 'Sakura Matou',
    title: 'the one who waits at home',
    accent: 0x8f73c2,
    mini: SAKURA_MINI,
    role: 'master',
  },
  shirou: {
    id: 'shirou',
    name: 'Shirou Emiya',
    title: 'does the work',
    accent: 0xd9622b,
    mini: SHIROU_MINI,
    role: 'master',
  },
  rin: {
    id: 'rin',
    name: 'Rin Tohsaka',
    title: 'strategist',
    accent: 0xc8302f,
    mini: RIN_MINI,
    role: 'master',
  },
  illya: {
    id: 'illya',
    name: 'Illyasviel',
    title: 'wild idea',
    accent: 0x5a3a8a,
    mini: ILLYA_MINI,
    role: 'master',
  },
  kirei: {
    id: 'kirei',
    name: 'Kotomine Kirei',
    title: 'keeper of the rules',
    accent: 0xd7b24a,
    mini: KIREI_MINI,
    role: 'master',
  },
  // Servants
  rider: {
    id: 'rider',
    name: 'Rider',
    title: 'scout',
    accent: 0xb9a3d9,
    mini: RIDER_MINI,
    role: 'servant',
    className: 'Rider',
    master: 'sakura',
  },
  saber: {
    id: 'saber',
    name: 'Saber',
    title: 'the King of Knights',
    accent: 0x2a4ea8,
    mini: SABER_MINI,
    role: 'servant',
    className: 'Saber',
    master: 'shirou',
  },
  'saber-alter': {
    id: 'saber-alter',
    name: 'Saber Alter',
    title: 'judge',
    accent: 0xf2d13a,
    mini: SABER_ALTER_MINI,
    role: 'servant',
    className: 'Saber',
    master: 'sakura',
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    title: 'reviewer',
    accent: 0xb3252a,
    mini: ARCHER_MINI,
    role: 'servant',
    className: 'Archer',
    master: 'rin',
  },
  lancer: {
    id: 'lancer',
    name: 'Lancer',
    title: 'the hound of Ulster',
    accent: 0x2c52d8,
    mini: LANCER_MINI,
    role: 'servant',
    className: 'Lancer',
    master: 'kirei',
  },
  caster: {
    id: 'caster',
    name: 'Caster',
    title: 'the witch of Colchis',
    accent: 0x9c48b4,
    mini: CASTER_MINI,
    role: 'servant',
    className: 'Caster',
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    title: 'the swordsman at the gate',
    accent: 0x5e5eb8,
    mini: ASSASSIN_MINI,
    role: 'servant',
    className: 'Assassin',
  },
  'true-assassin': {
    id: 'true-assassin',
    name: 'True Assassin',
    title: 'hunter',
    accent: 0xd9f0ff,
    mini: TRUE_ASSASSIN_MINI,
    role: 'servant',
    className: 'Assassin',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    title: 'brute force',
    accent: 0xe03030,
    mini: BERSERKER_MINI,
    role: 'servant',
    className: 'Berserker',
    master: 'illya',
  },
  gilgamesh: {
    id: 'gilgamesh',
    name: 'Gilgamesh',
    title: 'the King of Heroes',
    accent: 0xeec22c,
    mini: GILGAMESH_MINI,
    role: 'servant',
    className: 'Archer',
    master: 'kirei',
  },
}

/** The main portrait and all of its overlays, for iteration in tests and the renderer. */
export const SAKURA_PORTRAIT = {
  base: SAKURA_BASE,
  blink: SAKURA_BLINK,
  talk: SAKURA_TALK,
  happy: SAKURA_HAPPY,
  think: SAKURA_THINK,
  thinkDots: SAKURA_THINK_DOTS,
  ouch: SAKURA_OUCH,
  sleep: SAKURA_SLEEP,
  sleepZ: SAKURA_SLEEP_Z,
  search: SAKURA_SEARCH,
  edit: SAKURA_EDIT,
  run: SAKURA_RUN,
  summon: SAKURA_SUMMON,
  darkOverlay: DARK_SAKURA_OVERLAY,
  darkPalette: DARK_SAKURA_PALETTE,
} as const

// ---------------------------------------------------------------------------
// Self-check (run from a *.test.ts): every row the same length, every char in
// the palette (or '.' / '#'), every overlay the size of its base.
// ---------------------------------------------------------------------------

export type SpriteProblem = { where: string; problem: string }

const checkSprite = (where: string, s: Sprite, isOverlay: boolean): SpriteProblem[] => {
  const problems: SpriteProblem[] = []
  if (s.h !== s.rows.length) problems.push({ where, problem: `h=${s.h} but ${s.rows.length} rows` })
  s.rows.forEach((row, y) => {
    if (row.length !== s.w) problems.push({ where, problem: `row ${y} has length ${row.length}, expected ${s.w}` })
    for (const ch of row) {
      const isControl = ch === TRANSPARENT || (isOverlay && ch === ERASE)
      if (!isControl && s.palette[ch] === undefined) {
        problems.push({ where, problem: `row ${y}: char '${ch}' not in palette` })
      }
    }
  })
  return problems
}

const checkOverlay = (where: string, base: Sprite, overlay: Overlay): SpriteProblem[] => {
  const problems = checkSprite(where, overlay, true)
  if (overlay.w !== base.w || overlay.h !== base.h) {
    problems.push({ where, problem: `overlay is ${overlay.w}x${overlay.h}, base is ${base.w}x${base.h}` })
  }
  return problems
}

/** Returns every problem found; an empty array means the data is consistent. */
export const checkSprites = (): SpriteProblem[] => {
  const problems: SpriteProblem[] = []
  const P = SAKURA_PORTRAIT
  problems.push(...checkSprite('sakura.base', P.base, false))
  if (P.base.w !== 24 || P.base.h !== 32) problems.push({ where: 'sakura.base', problem: 'expected 24x32' })
  const singles: Array<[string, Overlay]> = [
    ['sakura.blink', P.blink],
    ['sakura.talk', P.talk],
    ['sakura.happy', P.happy],
    ['sakura.think', P.think],
    ['sakura.ouch', P.ouch],
    ['sakura.sleep', P.sleep],
    ['sakura.darkOverlay', P.darkOverlay],
  ]
  for (const [where, overlay] of singles) problems.push(...checkOverlay(where, P.base, overlay))
  const series: Array<[string, readonly Overlay[]]> = [
    ['sakura.thinkDots', P.thinkDots],
    ['sakura.sleepZ', P.sleepZ],
    ['sakura.search', P.search],
    ['sakura.edit', P.edit],
    ['sakura.run', P.run],
    ['sakura.summon', P.summon],
  ]
  for (const [where, frames] of series) {
    frames.forEach((f, i) => problems.push(...checkOverlay(`${where}[${i}]`, P.base, f)))
  }
  for (const ch of Object.keys(SAKURA_PALETTE)) {
    if (DARK_SAKURA_PALETTE[ch] === undefined) problems.push({ where: 'darkPalette', problem: `missing '${ch}'` })
  }
  problems.push(...checkSprite('sakuraHd.base', SAKURA_HD.base, false))
  if (SAKURA_HD.base.w !== 48 || SAKURA_HD.base.h !== 64) problems.push({ where: 'sakuraHd.base', problem: 'expected 48x64' })
  problems.push(...checkOverlay('sakuraHd.blink', SAKURA_HD.base, SAKURA_HD.blink))
  problems.push(...checkOverlay('sakuraHd.darkEyes', SAKURA_HD.base, SAKURA_HD.darkEyes))
  for (const ch of Object.keys(SAKURA_HD_PALETTE)) {
    if (SAKURA_HD_DARK_PALETTE[ch] === undefined) problems.push({ where: 'sakuraHd.darkPalette', problem: `missing '${ch}'` })
  }
  for (const entry of Object.values(CAST)) {
    const { base, blink, work } = entry.mini
    problems.push(...checkSprite(`${entry.id}.mini.base`, base, false))
    problems.push(...checkSprite(`${entry.id}.mini.blink`, blink, false))
    problems.push(...checkSprite(`${entry.id}.mini.work`, work, false))
    if (base.w !== 12 || base.h !== 12) problems.push({ where: `${entry.id}.mini.base`, problem: 'expected 12x12' })
    for (const [name, f] of [['blink', blink], ['work', work]] as const) {
      if (f.w !== base.w || f.h !== base.h) problems.push({ where: `${entry.id}.mini.${name}`, problem: 'size differs from base' })
    }
  }
  for (const [name, f] of Object.entries(DARK_SAKURA_MINI)) {
    problems.push(...checkSprite(`dark-sakura.mini.${name}`, f, false))
  }
  return problems
}
