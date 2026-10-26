import {
  boards,
  colors,
  finishes,
  findById,
  frameModes,
  handles,
  type BoardId,
  type ColorId,
  type FinishId,
  type FrameId,
  type HandleId,
  type HandlePosId,
  type HandleSideId,
  type SceneLook,
  clamp,
} from '../model'
import { prunePatterns, sanitizePatterns, type PatternAssign } from '../pattern/catalog'
import { limitsInOpening, type Envelope } from '../survey/model'

/** Обувница вроде ОБ-5: откидные ящики по две секции. */
export type ShoeConfig = {
  carcassBoard: BoardId
  carcassColor: ColorId
  facadeBoard: BoardId
  facadeColor: ColorId
  handle: HandleId
  handlePos: HandlePosId
  handleSide: HandleSideId
  finish: FinishId
  frame: FrameId
  width: number
  height: number
  depth: number
  drawers: number
  /** Щиты параллельно фасаду: обувь стоит носком вверх. */
  rows: number
  patterns: PatternAssign[]
}

export const shoeSections = 2

/** Минимальный просвет кармана между щитами под обувь стоя. */
export const shoeRowClearMm = 80

/** Высота одного ящика у ОБ-5: (1500 − 60) / 4. */
export const shoeDrawerModuleMm = 360
/** Опора и доля крышки/дна в общей высоте. */
export const shoeHeightExtraMm = 60

export const shoeLimits = {
  width: { min: 450, max: 900, step: 10 },
  height: { min: 780, max: 2400, step: 10 },
  depth: { min: 240, max: 360, step: 10 },
  drawers: { min: 2, max: 6, step: 1 },
  rows: { min: 1, max: 3, step: 1 },
}

/** Габарит ОБ-5: высота 1500 ширина 600 глубина 280. Четыре ящика. */
export const defaultShoeConfig: ShoeConfig = {
  carcassBoard: 'ldsp',
  carcassColor: 'white',
  facadeBoard: 'ldsp',
  facadeColor: 'white',
  handle: 'knob',
  handlePos: 'top',
  handleSide: 'open',
  finish: 'chrome',
  frame: 'plain',
  width: 600,
  height: 1500,
  depth: 280,
  drawers: 4,
  rows: 2,
  patterns: [],
}

/** Высота корпуса от числа ящиков. */
export function shoeHeightForDrawers(drawers: number) {
  const count = clampInt(drawers, shoeLimits.drawers.min, shoeLimits.drawers.max)
  return clamp(
    count * shoeDrawerModuleMm + shoeHeightExtraMm,
    shoeLimits.height.min,
    shoeLimits.height.max,
  )
}

/** Фактическая высота фасада ящика в мм. */
export function shoeFaceHeightMm(config: ShoeConfig) {
  const lift = 50
  const gap = 4
  const body = Math.max(400, config.height - lift)
  const face = (body - gap * (config.drawers + 1)) / config.drawers
  return Math.round(face)
}

const handleIds = new Set(handles.map((item) => item.id))
const frameIds = new Set(frameModes.map((item) => item.id))

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max))
}

export function sanitizeShoe(input: ShoeConfig, opening: Envelope | null = null): ShoeConfig {
  const lim = limitsInOpening(shoeLimits, opening)
  const next: ShoeConfig = { ...defaultShoeConfig, ...input }
  next.drawers = clampInt(next.drawers, shoeLimits.drawers.min, shoeLimits.drawers.max)
  next.rows = clampInt(next.rows, shoeLimits.rows.min, shoeLimits.rows.max)
  next.width = clamp(next.width, Math.min(lim.width.min, lim.width.max), lim.width.max)
  next.depth = clamp(next.depth, Math.min(lim.depth.min, lim.depth.max), lim.depth.max)
  next.height = clamp(next.height, Math.min(lim.height.min, lim.height.max), lim.height.max)
  if (next.handlePos !== 'top' && next.handlePos !== 'middle' && next.handlePos !== 'bottom') next.handlePos = 'top'
  if (next.handleSide !== 'open' && next.handleSide !== 'hinge' && next.handleSide !== 'center') next.handleSide = 'open'
  if (!handleIds.has(next.handle)) next.handle = 'knob'
  if (!frameIds.has(next.frame)) next.frame = 'plain'
  next.patterns = prunePatterns(
    sanitizePatterns(next.patterns),
    Array.from({ length: next.drawers }, (_, k) => `shoe-face-${k}`),
  )
  return next
}

/** Смена числа ящиков с пересчётом высоты корпуса. */
export function setShoeDrawers(config: ShoeConfig, drawers: number): ShoeConfig {
  const count = clampInt(drawers, shoeLimits.drawers.min, shoeLimits.drawers.max)
  return sanitizeShoe({
    ...config,
    drawers: count,
    height: shoeHeightForDrawers(count),
  })
}

export function readShoeConfig(value: unknown): ShoeConfig | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<ShoeConfig> & { kind?: string }
  if (raw.kind && raw.kind !== 'shoe') return null
  if (typeof raw.width !== 'number') return null
  return sanitizeShoe({ ...defaultShoeConfig, ...raw })
}

export type ShoeRuleTip = {
  field: string
  level: 'warn' | 'bad'
  text: string
}

export function checkShoeRules(config: ShoeConfig): ShoeRuleTip[] {
  const tips: ShoeRuleTip[] = []
  const bay = Math.round(config.width / shoeSections)
  const box = shoeFaceHeightMm(config)
  const pocket = Math.round((config.depth - 50 - 16 * config.rows) / (config.rows + 1))
  if (bay < 250) tips.push({ field: 'width', level: 'bad', text: `Секция ${bay} мм. Для пары обуви тесно.` })
  else if (bay < 280) tips.push({ field: 'width', level: 'warn', text: `Секция ${bay} мм. У ОБ-5 около 300 мм.` })
  if (config.depth < 270) tips.push({ field: 'depth', level: 'warn', text: 'Для обуви глубина обычно от 280 мм.' })
  if (box < 280) tips.push({ field: 'drawers', level: 'warn', text: `Ящик ${box} мм. Откидной удобнее от 300 мм.` })
  else if (box < 320) tips.push({ field: 'height', level: 'warn', text: `Фасад ящика ${box} мм. У ОБ-5 около 360 мм.` })
  if (pocket < shoeRowClearMm) {
    tips.push({ field: 'rows', level: 'warn', text: `Карман ~${pocket} мм. Для обуви стоя лучше от ${shoeRowClearMm} мм.` })
  }
  return tips
}

export function tipForShoe(tips: ShoeRuleTip[], field: string) {
  return tips.find((tip) => tip.field === field) ?? null
}

export function shoeSummary(config: ShoeConfig) {
  return {
    color: findById(colors, config.facadeColor).name,
    board: findById(boards, config.facadeBoard).name,
    handle: findById(handles, config.handle).name,
    finish: findById(finishes, config.finish).name,
    frame: findById(frameModes, config.frame).name,
  }
}

export function shoeAsSceneLook(config: ShoeConfig): SceneLook {
  return {
    carcassBoard: config.carcassBoard,
    carcassColor: config.carcassColor,
    facadeBoard: config.facadeBoard,
    facadeColor: config.facadeColor,
    handle: config.handle,
    handlePos: config.handlePos,
    handleSide: config.handleSide,
    finish: config.finish,
    frame: config.frame,
    mirror: 'none',
  }
}
