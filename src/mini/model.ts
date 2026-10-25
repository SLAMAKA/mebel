import {
  boards,
  colors,
  finishes,
  findById,
  frameModes,
  handles,
  type BaseId,
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
import { limitsInOpening, type Envelope } from '../survey/model'

/** Крепление мини-шкафчика. */
export type MiniMountId = 'wall' | 'floor'

/** Тип фасада мини. */
export type MiniFrontId = 'swing' | 'open' | 'flip'

/** Стили ножек для напольного мини. */
export type MiniLegId = 'square' | 'round' | 'pin' | 'block' | 'hairpin'

export type MiniVariantId = 'hang40' | 'hang60' | 'floor60' | 'double80' | 'bath50' | 'openShelf'

export type MiniConfig = {
  variant: MiniVariantId
  mount: MiniMountId
  front: MiniFrontId
  leg: MiniLegId
  carcassBoard: BoardId
  carcassColor: ColorId
  facadeBoard: BoardId
  facadeColor: ColorId
  handle: HandleId
  handlePos: HandlePosId
  handleSide: HandleSideId
  finish: FinishId
  base: BaseId
  frame: FrameId
  width: number
  height: number
  depth: number
  sections: number
  shelves: number
}

export type MiniLimits = {
  width: { min: number; max: number; step: number }
  height: { min: number; max: number; step: number }
  depth: { min: number; max: number; step: number }
  sections: { min: number; max: number; step: number }
  shelves: { min: number; max: number; step: number }
}

export const miniLimits: MiniLimits = {
  width: { min: 300, max: 1000, step: 10 },
  height: { min: 400, max: 1400, step: 10 },
  depth: { min: 200, max: 450, step: 10 },
  sections: { min: 1, max: 3, step: 1 },
  shelves: { min: 0, max: 6, step: 1 },
}

export const miniMounts: { id: MiniMountId; name: string }[] = [
  { id: 'wall', name: 'Навесной' },
  { id: 'floor', name: 'Напольный' },
]

export const miniFronts: { id: MiniFrontId; name: string }[] = [
  { id: 'swing', name: 'Дверцы' },
  { id: 'flip', name: 'Откидная' },
  { id: 'open', name: 'Открытый' },
]

export const miniLegs: { id: MiniLegId; name: string }[] = [
  { id: 'square', name: 'Квадрат' },
  { id: 'round', name: 'Круглые' },
  { id: 'pin', name: 'Шпилька' },
  { id: 'hairpin', name: 'Тонкие' },
  { id: 'block', name: 'Брусок' },
]

export type MiniVariant = {
  id: MiniVariantId
  name: string
  hint: string
  patch: Partial<MiniConfig>
}

/** Свои варианты мини-шкафчика. */
export const miniVariants: MiniVariant[] = [
  {
    id: 'hang40',
    name: 'Навесной 40',
    hint: 'Узкий над столом или в нише',
    patch: {
      mount: 'wall',
      front: 'swing',
      width: 400,
      height: 700,
      depth: 300,
      sections: 1,
      shelves: 2,
      handle: 'knob',
      base: 'plinth',
    },
  },
  {
    id: 'hang60',
    name: 'Навесной 60',
    hint: 'Стандарт на стену',
    patch: {
      mount: 'wall',
      front: 'swing',
      width: 600,
      height: 800,
      depth: 320,
      sections: 1,
      shelves: 2,
      handle: 'knob',
    },
  },
  {
    id: 'floor60',
    name: 'Напольный 60',
    hint: 'Комод-мини на ножках',
    patch: {
      mount: 'floor',
      front: 'swing',
      width: 600,
      height: 900,
      depth: 350,
      sections: 1,
      shelves: 2,
      base: 'legs',
      leg: 'pin',
      handle: 'bar',
    },
  },
  {
    id: 'double80',
    name: 'Двойной 80',
    hint: 'Две секции рядом',
    patch: {
      mount: 'floor',
      front: 'swing',
      width: 800,
      height: 1000,
      depth: 380,
      sections: 2,
      shelves: 2,
      base: 'plinth',
      leg: 'square',
      handle: 'bar',
    },
  },
  {
    id: 'bath50',
    name: 'Ванная 50',
    hint: 'Влагостойкий узкий',
    patch: {
      mount: 'wall',
      front: 'flip',
      width: 500,
      height: 600,
      depth: 250,
      sections: 1,
      shelves: 1,
      facadeColor: 'white',
      carcassColor: 'white',
      handle: 'edge',
      frame: 'thin',
    },
  },
  {
    id: 'openShelf',
    name: 'Полки',
    hint: 'Без дверей витрина',
    patch: {
      mount: 'wall',
      front: 'open',
      width: 600,
      height: 800,
      depth: 280,
      sections: 1,
      shelves: 3,
      handle: 'none',
    },
  },
]

export const defaultMiniConfig: MiniConfig = {
  variant: 'hang60',
  mount: 'wall',
  front: 'swing',
  leg: 'square',
  carcassBoard: 'ldsp',
  carcassColor: 'white',
  facadeBoard: 'mdf',
  facadeColor: 'oak',
  handle: 'knob',
  handlePos: 'middle',
  handleSide: 'open',
  finish: 'black',
  base: 'plinth',
  frame: 'plain',
  width: 600,
  height: 800,
  depth: 320,
  sections: 1,
  shelves: 2,
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max))
}

const variantIds = new Set(miniVariants.map((item) => item.id))
const mountIds = new Set(miniMounts.map((item) => item.id))
const frontIds = new Set(miniFronts.map((item) => item.id))
const legIds = new Set(miniLegs.map((item) => item.id))
const handleIds = new Set(handles.map((item) => item.id))
const frameIds = new Set(frameModes.map((item) => item.id))

export function applyMiniVariant(config: MiniConfig, id: MiniVariantId): MiniConfig {
  const variant = findById(miniVariants, id)
  return sanitizeMini({ ...config, ...variant.patch, variant: id })
}

export function sanitizeMini(input: MiniConfig, opening: Envelope | null = null): MiniConfig {
  const lim = limitsInOpening(miniLimits, opening)
  const next: MiniConfig = { ...defaultMiniConfig, ...input }
  next.variant = variantIds.has(next.variant) ? next.variant : 'hang60'
  next.mount = mountIds.has(next.mount) ? next.mount : 'wall'
  next.front = frontIds.has(next.front) ? next.front : 'swing'
  next.leg = legIds.has(next.leg) ? next.leg : 'square'
  next.width = clamp(next.width, Math.min(lim.width.min, lim.width.max), lim.width.max)
  next.height = clamp(next.height, Math.min(lim.height.min, lim.height.max), lim.height.max)
  next.depth = clamp(next.depth, Math.min(lim.depth.min, lim.depth.max), lim.depth.max)
  next.sections = clampInt(next.sections, miniLimits.sections.min, miniLimits.sections.max)
  next.shelves = clampInt(next.shelves, miniLimits.shelves.min, miniLimits.shelves.max)
  if (next.base !== 'plinth' && next.base !== 'legs') next.base = 'plinth'
  if (next.mount === 'wall') next.base = 'plinth'
  if (next.handlePos !== 'top' && next.handlePos !== 'middle' && next.handlePos !== 'bottom') next.handlePos = 'middle'
  if (next.handleSide !== 'open' && next.handleSide !== 'hinge') next.handleSide = 'open'
  if (!handleIds.has(next.handle)) next.handle = 'knob'
  if (!frameIds.has(next.frame)) next.frame = 'plain'
  if (next.front === 'open') next.handle = 'none'
  return next
}

export function readMiniConfig(value: unknown): MiniConfig | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MiniConfig> & { kind?: string }
  if (raw.kind && raw.kind !== 'mini') return null
  if (typeof raw.width !== 'number') return null
  return sanitizeMini({ ...defaultMiniConfig, ...raw })
}

export type MiniRuleTip = {
  field: string
  level: 'warn' | 'bad'
  text: string
}

export function checkMiniRules(config: MiniConfig): MiniRuleTip[] {
  const tips: MiniRuleTip[] = []
  const bay = Math.round(config.width / config.sections)
  if (bay < 280) tips.push({ field: 'sections', level: 'bad', text: `Секция ${bay} мм. Уже тесно.` })
  else if (bay < 320) tips.push({ field: 'sections', level: 'warn', text: `Секция ${bay} мм. Для мини обычно от 320 мм.` })
  if (config.mount === 'wall' && config.depth > 400) {
    tips.push({ field: 'depth', level: 'warn', text: 'Глубокий навесной тяжелее крепить к стене.' })
  }
  if (config.front === 'flip' && config.height > 800) {
    tips.push({ field: 'front', level: 'warn', text: 'Откидная выше 800 мм неудобна. Лучше дверцы.' })
  }
  if (config.front === 'open' && config.shelves < 1) {
    tips.push({ field: 'shelves', level: 'warn', text: 'Открытый шкафчик без полок почти пустой.' })
  }
  return tips
}

export function tipForMini(tips: MiniRuleTip[], field: string) {
  return tips.find((tip) => tip.field === field) ?? null
}

export function miniSummary(config: MiniConfig) {
  const variant = findById(miniVariants, config.variant)
  const mount = findById(miniMounts, config.mount)
  const front = findById(miniFronts, config.front)
  const leg = findById(miniLegs, config.leg)
  return {
    variant: variant.name,
    mount: mount.name,
    front: front.name,
    leg: leg.name,
    base: config.base === 'legs' ? 'Ножки' : 'Цоколь',
    color: findById(colors, config.facadeColor).name,
    board: findById(boards, config.facadeBoard).name,
    handle: findById(handles, config.handle).name,
    finish: findById(finishes, config.finish).name,
    frame: findById(frameModes, config.frame).name,
  }
}

/** Для сцены. */
export function miniAsSceneLook(config: MiniConfig): SceneLook {
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
