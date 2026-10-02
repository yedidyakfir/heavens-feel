// Sprite -> pixel grid -> terminal Raster cells (half blocks) or desktop SVG rects.
import type { Overlay, Palette, Sprite } from './sprites'

export type Grid = { w: number; h: number; px: Int32Array }

const TRANSPARENT = -1
const KEEP = '.'
const ERASE = '#'
const DEFAULT_COLOR = 0x01000000
const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const FULL_BLOCK = 0x2588
const SPACE = 0x20

export const compose = (base: Sprite, overlays: readonly Overlay[], palette?: Palette): Grid => {
  const colors = palette ?? base.palette
  const px = new Int32Array(base.w * base.h)
  for (let y = 0; y < base.h; y++) {
    const rows = [base.rows[y] ?? '', ...overlays.map(o => o.rows[y] ?? '')]
    for (let x = 0; x < base.w; x++) {
      let ch = rows[0]![x] ?? KEEP
      for (const row of rows.slice(1)) {
        const over = row[x] ?? KEEP
        if (over !== KEEP) ch = over
      }
      px[y * base.w + x] = ch === KEEP || ch === ERASE ? TRANSPARENT : (colors[ch] ?? TRANSPARENT)
    }
  }
  return { w: base.w, h: base.h, px }
}

/** Moves every pixel by (dx, dy); what slides in is transparent. */
export const shift = (grid: Grid, dx: number, dy: number): Grid => {
  const px = new Int32Array(grid.w * grid.h).fill(TRANSPARENT)
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const sx = x - dx
      const sy = y - dy
      if (sx >= 0 && sy >= 0 && sx < grid.w && sy < grid.h) px[y * grid.w + x] = grid.px[sy * grid.w + sx]!
    }
  }
  return { w: grid.w, h: grid.h, px }
}

/** The top `rows` pixel rows of the grid. */
export const crop = (grid: Grid, rows: number): Grid => ({ w: grid.w, h: rows, px: grid.px.slice(0, grid.w * rows) })

/** Paints `points` (x, y, color) onto a copy of the grid. */
export const paint = (grid: Grid, points: readonly (readonly [number, number, number])[]): Grid => {
  const px = grid.px.slice()
  for (const [x, y, color] of points) {
    if (x >= 0 && y >= 0 && x < grid.w && y < grid.h) px[y * grid.w + x] = color
  }
  return { w: grid.w, h: grid.h, px }
}

const at = (grid: Grid, x: number, y: number): number =>
  y < grid.h ? grid.px[y * grid.w + x]! : TRANSPARENT

const cellFor = (top: number, bottom: number): readonly [number, number, number] => {
  if (top !== TRANSPARENT && bottom !== TRANSPARENT) return [UPPER_HALF, top, bottom]
  if (top !== TRANSPARENT) return [UPPER_HALF, top, DEFAULT_COLOR]
  if (bottom !== TRANSPARENT) return [LOWER_HALF, bottom, DEFAULT_COLOR]
  return [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64, the encoding Raster cells take. */
export const toBase64 = (bytes: Uint8Array): string => {
  const out: string[] = []
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out.push(
      BASE64[(n >> 18) & 63]!,
      BASE64[(n >> 12) & 63]!,
      i + 1 < bytes.length ? BASE64[(n >> 6) & 63]! : '=',
      i + 2 < bytes.length ? BASE64[n & 63]! : '=',
    )
  }
  return out.join('')
}

export type RasterCells = { columns: number; rows: number; cells: string }

/** Scale 1: one pixel per column, two per row. Scale 2: two columns and one row per pixel. */
export const gridToRaster = (grid: Grid, scale: 1 | 2): RasterCells => {
  const columns = grid.w * scale
  const rows = scale === 1 ? Math.ceil(grid.h / 2) : grid.h
  const words = new Uint32Array(columns * rows * 3)
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < grid.w; x++) {
      if (scale === 1) {
        words.set(cellFor(at(grid, x, 2 * r), at(grid, x, 2 * r + 1)), i)
        i += 3
        continue
      }
      const color = at(grid, x, r)
      const cell = color === TRANSPARENT ? [SPACE, DEFAULT_COLOR, DEFAULT_COLOR] : [FULL_BLOCK, color, color]
      words.set(cell, i)
      words.set(cell, i + 3)
      i += 6
    }
  }
  return { columns, rows, cells: toBase64(new Uint8Array(words.buffer)) }
}

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/** Runs of one colour per row, as path commands: far shorter than a <rect> per run. */
const pathsOf = (grid: Grid): Map<number, string[]> => {
  const byColor = new Map<number, string[]>()
  for (let y = 0; y < grid.h; y++) {
    let x = 0
    while (x < grid.w) {
      const color = at(grid, x, y)
      let run = 1
      while (x + run < grid.w && at(grid, x + run, y) === color) run++
      const runs = byColor.get(color) ?? []
      runs.push(`M${x} ${y}h${run}v1h-${run}z`)
      byColor.set(color, runs)
      x += run
    }
  }
  return byColor
}

const ERASED = -2

/** Erased pixels take the backdrop's colour: a fixed fill, or the shared class `auto` themes. */
const drawPaths = (byColor: Map<number, string[]>, erasedFill: string): string =>
  [...byColor]
    .filter(([color]) => color !== TRANSPARENT)
    .map(([color, runs]) => `<path ${color === ERASED ? erasedFill : `fill="${hex(color)}"`} d="${runs.join('')}"/>`)
    .join('')

/** Pixels of `over` that differ from `base`; where `over` is see-through, the backdrop shows. */
const delta = (base: Grid, over: Grid): Grid => {
  const px = new Int32Array(base.w * base.h).fill(TRANSPARENT)
  over.px.forEach((color, i) => {
    if (color !== base.px[i]) px[i] = color === TRANSPARENT ? ERASED : color
  })
  return { w: base.w, h: base.h, px }
}

export type Backdrop = { theme: 'light' | 'dark' | 'auto'; accent: number }

const BACKDROP = { light: { bg: '#faf9f5', glow: 0.18 }, dark: { bg: '#262624', glow: 0.28 } }

/**
 * Several of these Svgs can share one document, where every <style> applies to all of them,
 * so a fixed theme paints with attributes and only `auto` uses a class, the same rule in each.
 */
const AUTO_CLASS = 'hf-backdrop'
const AUTO_STYLE = `<style>.${AUTO_CLASS}{fill:${BACKDROP.light.bg}}@media (prefers-color-scheme: dark){.${AUTO_CLASS}{fill:${BACKDROP.dark.bg}}}</style>`

const backdropFill = (backdrop: Backdrop | undefined): string => {
  if (!backdrop) return 'fill="none"'
  return backdrop.theme === 'auto' ? `class="${AUTO_CLASS}"` : `fill="${BACKDROP[backdrop.theme].bg}"`
}

/** Theme-coloured background with a soft glow in the character's colour under her feet. */
const backdropOf = (grid: Grid, backdrop: Backdrop): string => {
  const glow = backdrop.theme === 'light' ? BACKDROP.light.glow : BACKDROP.dark.glow
  return (
    (backdrop.theme === 'auto' ? AUTO_STYLE : '') +
    `<rect ${backdropFill(backdrop)} x="-2" y="-2" width="${grid.w + 4}" height="${grid.h + 4}"/>` +
    `<ellipse cx="${grid.w / 2}" cy="${grid.h - 2}" rx="${grid.w * 0.36}" ry="2.2" fill="${hex(backdrop.accent)}" opacity="${glow}"/>`
  )
}

export type SvgOptions = {
  pixel: number
  /** Further frames, looped one after another every `frameMs` (SMIL, no re-render). */
  frames?: readonly Grid[]
  frameMs?: number
  blink?: Grid
  isBreathing?: boolean
  backdrop?: Backdrop
}

const visibleDuring = (k: number, n: number, durMs: number): string =>
  `<animate attributeName="visibility" values="hidden;visible;hidden" keyTimes="0;${(k / n).toFixed(4)};${((k + 1) / n).toFixed(4)}" calcMode="discrete" dur="${durMs}ms" repeatCount="indefinite"/>`

/**
 * One portrait as an Svg: the first frame drawn whole, each further frame as its
 * difference shown in turn, the blink and the breathing bob as their own loops.
 * Every loop is SMIL, so it animates with no redraw (the Svg must be `isInteractive`).
 */
export const gridToSvg = (grid: Grid, options: SvgOptions): string => {
  const width = grid.w * options.pixel
  const height = (grid.h + 1) * options.pixel
  const frames = options.frames ?? []
  const n = frames.length + 1
  const durMs = (options.frameMs ?? 400) * n
  const erasedFill = backdropFill(options.backdrop)
  const loop = frames
    .map((next, i) => `<g visibility="hidden">${drawPaths(pathsOf(delta(grid, next)), erasedFill)}${visibleDuring(i + 1, n, durMs)}</g>`)
    .join('')
  const blinkGroup = options.blink
    ? `<g opacity="0">${drawPaths(pathsOf(delta(grid, options.blink)), erasedFill)}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.93;0.94;0.98;1" dur="4.2s" repeatCount="indefinite"/></g>`
    : ''
  const bob = options.isBreathing
    ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 1;0 0" dur="2.4s" calcMode="discrete" repeatCount="indefinite"/>'
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -1 ${grid.w} ${grid.h + 1}" width="${width}" height="${height}" shape-rendering="crispEdges">` +
    (options.backdrop ? backdropOf(grid, options.backdrop) : '') +
    `<g>${drawPaths(pathsOf(grid), erasedFill)}${loop}${blinkGroup}${bob}</g></svg>`
  )
}
