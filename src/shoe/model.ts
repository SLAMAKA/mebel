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
}

export const shoeSections = 2

export const shoeLimits = {
  width: { min: 450, max: 900, step: 10 },
  height: { min: 900, max: 1800, step: 10 },
  depth: { min: 240, max: 360, step: 10 },
  drawers: { min: 2, max: 6, step: 1 },
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
}

const handleIds = new Set(handles.map((item) => item.id))
const frameIds = new Set(frameModes.map((item) => item.id))

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max))
}

export function sanitizeShoe(input: ShoeConfig): ShoeConfig {
  const next: ShoeConfig = { ...defaultShoeConfig, ...input }
  next.width = clamp(next.width, shoeLimits.width.min, shoeLimits.width.max)
  next.height = clamp(next.height, shoeLimits.height.min, shoeLimits.height.max)
  next.depth = clamp(next.depth, shoeLimits.depth.min, shoeLimits.depth.max)
  next.drawers = clampInt(next.drawers, shoeLimits.drawers.min, shoeLimits.drawers.max)
  if (next.handlePos !== 'top' && next.handlePos !== 'middle' && next.handlePos !== 'bottom') next.handlePos = 'top'
  if (next.handleSide !== 'open' && next.handleSide !== 'hinge') next.handleSide = 'open'
  if (!handleIds.has(next.handle)) next.handle = 'knob'
  if (!frameIds.has(next.frame)) next.frame = 'plain'
  return next
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
  const box = Math.round((config.height - 50) / config.drawers)
  if (bay < 250) tips.push({ field: 'width', level: 'bad', text: `Секция ${bay} мм. Для пары обуви тесно.` })
  else if (bay < 280) tips.push({ field: 'width', level: 'warn', text: `Секция ${bay} мм. У ОБ-5 около 300 мм.` })
  if (config.depth < 270) tips.push({ field: 'depth', level: 'warn', text: 'Для обуви глубина обычно от 280 мм.' })
  if (box < 300) tips.push({ field: 'drawers', level: 'warn', text: `Ящик ${box} мм. Откидной удобнее от 320 мм.` })
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
