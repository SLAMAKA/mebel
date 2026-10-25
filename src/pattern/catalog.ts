export type PatternId =
  | 'none'
  | 'flutes-v'
  | 'flutes-h'
  | 'grid'
  | 'diamonds'
  | 'chevron'
  | 'waves'
  | 'circles'
  | 'ripples'

export type PatternApply = 'surface' | 'mill' | 'cut'

export type PatternAssign = {
  partKey: string
  id: PatternId
  apply: PatternApply
  depth: number
  margin: number
  step: number
}

export const PATTERN_DEPTH = 3
export const PATTERN_MARGIN = 30
export const PATTERN_STEP = 40

export const patternModes: { id: PatternId; name: string }[] = [
  { id: 'none', name: 'Без узора' },
  { id: 'flutes-v', name: 'Вертикальные' },
  { id: 'flutes-h', name: 'Горизонтальные' },
  { id: 'grid', name: 'Сетка' },
  { id: 'diamonds', name: 'Ромбы' },
  { id: 'chevron', name: 'Шеврон' },
  { id: 'waves', name: 'Волны' },
  { id: 'circles', name: 'Круги' },
  { id: 'ripples', name: 'Кольца' },
]

export const patternApplyModes: { id: PatternApply; name: string }[] = [
  { id: 'surface', name: 'На поверхности' },
  { id: 'mill', name: 'Выборка ЧПУ' },
  { id: 'cut', name: 'Вырез ЧПУ' },
]

const applyIds = new Set(patternApplyModes.map((item) => item.id))

const patternIds = new Set(patternModes.map((item) => item.id))

export function patternName(id: PatternId) {
  return patternModes.find((item) => item.id === id)?.name ?? 'Без узора'
}

export function applyName(id: PatternApply) {
  return patternApplyModes.find((item) => item.id === id)?.name ?? 'На поверхности'
}

export function blankPattern(partKey: string): PatternAssign {
  return {
    partKey,
    id: 'none',
    apply: 'surface',
    depth: PATTERN_DEPTH,
    margin: PATTERN_MARGIN,
    step: PATTERN_STEP,
  }
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNum(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Отступ рамки в мм. Гладкий щит — узор на всю лицевую. */
export function frameInsetMm(frame: string) {
  if (frame === 'thin') return 30
  if (frame === 'classic') return 66
  if (frame === 'wide') return 86
  if (frame === 'double') return 100
  if (frame === 'bevel') return 82
  return 0
}

export function hasFrame(frame: string) {
  return frame !== 'plain'
}

export function assignmentFor(patterns: PatternAssign[] | undefined, partKey: string): PatternAssign {
  const found = patterns?.find((item) => item.partKey === partKey)
  return found ? { ...found } : blankPattern(partKey)
}

export function sanitizePatterns(raw: unknown): PatternAssign[] {
  if (!Array.isArray(raw)) return []
  const map = new Map<string, PatternAssign>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<PatternAssign>
    if (typeof row.partKey !== 'string' || !row.partKey) continue
    const id = patternIds.has(row.id as PatternId) ? (row.id as PatternId) : 'none'
    if (id === 'none') continue
    const apply = applyIds.has(row.apply as PatternApply) ? (row.apply as PatternApply) : 'mill'
    map.set(row.partKey, {
      partKey: row.partKey,
      id,
      apply,
      depth: clampNum(Math.round(finite(row.depth, PATTERN_DEPTH)), 1, 8),
      margin: clampNum(Math.round(finite(row.margin, PATTERN_MARGIN)), 0, 160),
      step: clampNum(Math.round(finite(row.step, PATTERN_STEP)), 16, 160),
    })
  }
  return [...map.values()]
}

export function prunePatterns(list: PatternAssign[], keys: Iterable<string>): PatternAssign[] {
  const live = new Set(keys)
  return list.filter((item) => live.has(item.partKey))
}

export function setPattern(list: PatternAssign[], next: PatternAssign): PatternAssign[] {
  const rest = list.filter((item) => item.partKey !== next.partKey)
  if (next.id === 'none') return rest
  return [...rest, next]
}

export function rippleDefaults(minMargin: number): Pick<PatternAssign, 'step' | 'margin'> {
  return {
    step: 18,
    margin: Math.max(2, minMargin),
  }
}

export function copyPatternToKeys(source: PatternAssign, keys: string[]): PatternAssign[] {
  if (source.id === 'none') return []
  return keys.map((partKey) => ({ ...source, partKey }))
}

export function patternSummary(list: PatternAssign[] | undefined) {
  const rows = list ?? []
  if (!rows.length) return 'без узора'
  const names = [...new Set(rows.map((item) => patternName(item.id)))]
  const ways = [...new Set(rows.map((item) => applyName(item.apply)))]
  return `${names.join(' · ')} · ${ways.join(' · ')} · ${rows.length} фас.`
}
