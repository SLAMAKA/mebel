export type BoardId = 'ldsp' | 'mdf' | 'veneer'
export type ColorId = 'white' | 'oak' | 'walnut' | 'graphite' | 'sage' | 'sand' | 'navy' | 'terra'
export type HandleId = 'bar' | 'knob' | 'rail' | 'bow' | 'edge' | 'none'
export type HandlePosId = 'top' | 'middle' | 'bottom'
export type HandleSideId = 'open' | 'hinge'
export type FinishId = 'chrome' | 'black' | 'gold' | 'white'
export type BaseId = 'plinth' | 'legs'
export type DoorId = 'swing' | 'slide' | 'open'
export type FrameId = 'plain' | 'thin' | 'classic' | 'wide' | 'double' | 'bevel'
export type MirrorId = 'none' | 'full' | 'panel' | 'oval' | 'strip'

export type Config = {
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
  mirror: MirrorId
  width: number
  height: number
  depth: number
  sections: number
  shelves: number
  doors: DoorId
}

export const boards: { id: BoardId; name: string; roughness: number }[] = [
  { id: 'ldsp', name: 'ЛДСП', roughness: 0.55 },
  { id: 'mdf', name: 'МДФ', roughness: 0.28 },
  { id: 'veneer', name: 'Шпон', roughness: 0.68 },
]

export const colors: { id: ColorId; name: string; hex: string }[] = [
  { id: 'white', name: 'Белый', hex: '#f3f0e8' },
  { id: 'oak', name: 'Дуб', hex: '#c4a36e' },
  { id: 'walnut', name: 'Орех', hex: '#6b422c' },
  { id: 'graphite', name: 'Графит', hex: '#3d4248' },
  { id: 'sage', name: 'Шалфей', hex: '#8ea394' },
  { id: 'sand', name: 'Песок', hex: '#d8c4a2' },
  { id: 'navy', name: 'Синий', hex: '#2d3c52' },
  { id: 'terra', name: 'Терракота', hex: '#b65d42' },
]

/** Частые виды ручек для быстрого выбора. */
export const handles: { id: HandleId; name: string }[] = [
  { id: 'bar', name: 'Скоба' },
  { id: 'knob', name: 'Кнопка' },
  { id: 'rail', name: 'Рейлинг' },
  { id: 'bow', name: 'Дуга' },
  { id: 'edge', name: 'Профиль' },
  { id: 'none', name: 'Без ручки' },
]

export const handlePositions: { id: HandlePosId; name: string }[] = [
  { id: 'top', name: 'Верх' },
  { id: 'middle', name: 'Середина' },
  { id: 'bottom', name: 'Низ' },
]

export const handleSides: { id: HandleSideId; name: string }[] = [
  { id: 'open', name: 'У открытия' },
  { id: 'hinge', name: 'У петли' },
]

export const finishes: { id: FinishId; name: string; color: string; roughness: number; metalness: number }[] = [
  { id: 'chrome', name: 'Хром', color: '#d7dbdf', roughness: 0.16, metalness: 0.92 },
  { id: 'black', name: 'Чёрный', color: '#1b1b1b', roughness: 0.4, metalness: 0.5 },
  { id: 'gold', name: 'Золото', color: '#c6a15a', roughness: 0.28, metalness: 0.84 },
  { id: 'white', name: 'Белый', color: '#f3f2ee', roughness: 0.45, metalness: 0.08 },
]

export const bases: { id: BaseId; name: string }[] = [
  { id: 'plinth', name: 'Цоколь' },
  { id: 'legs', name: 'Ножки' },
]

export const doorModes: { id: DoorId; name: string }[] = [
  { id: 'swing', name: 'Распашные' },
  { id: 'slide', name: 'Купе' },
  { id: 'open', name: 'Без дверей' },
]

export const frameModes: { id: FrameId; name: string }[] = [
  { id: 'plain', name: 'Гладкий' },
  { id: 'thin', name: 'Узкая' },
  { id: 'classic', name: 'Классика' },
  { id: 'wide', name: 'Широкая' },
  { id: 'double', name: 'Двойная' },
  { id: 'bevel', name: 'Фаска' },
]

export const mirrorModes: { id: MirrorId; name: string }[] = [
  { id: 'none', name: 'Без зеркала' },
  { id: 'full', name: 'Во всё' },
  { id: 'panel', name: 'Прямоугольное' },
  { id: 'oval', name: 'Овал' },
  { id: 'strip', name: 'Полоса' },
]

export const limits = {
  width: { min: 400, max: 2400, step: 10 },
  height: { min: 1200, max: 2800, step: 10 },
  depth: { min: 300, max: 700, step: 10 },
  sections: { min: 1, max: 5, step: 1 },
  shelves: { min: 0, max: 8, step: 1 },
}

export const defaultConfig: Config = {
  carcassBoard: 'ldsp',
  carcassColor: 'white',
  facadeBoard: 'mdf',
  facadeColor: 'oak',
  handle: 'bar',
  handlePos: 'middle',
  handleSide: 'open',
  finish: 'black',
  base: 'plinth',
  frame: 'plain',
  mirror: 'none',
  width: 1200,
  height: 2200,
  depth: 560,
  sections: 2,
  shelves: 3,
  doors: 'swing',
}

export type Preset = {
  name: string
  patch: Partial<Config>
}

export const presets: Preset[] = [
  { name: 'Узкий 60', patch: { width: 600, height: 2100, depth: 520, sections: 1, shelves: 4, doors: 'swing', mirror: 'none' } },
  { name: 'Стандарт 120', patch: { width: 1200, height: 2200, depth: 560, sections: 2, shelves: 3, doors: 'swing', mirror: 'none' } },
  { name: 'С зеркалом', patch: { width: 1200, height: 2200, depth: 560, sections: 2, shelves: 3, doors: 'swing', mirror: 'full', frame: 'thin', handle: 'edge' } },
  { name: 'Широкий 180', patch: { width: 1800, height: 2400, depth: 600, sections: 3, shelves: 4, doors: 'slide', mirror: 'none' } },
]

export function findById<T extends { id: string }>(list: T[], id: string) {
  return list.find((item) => item.id === id) ?? list[0]
}

export type RuleTip = {
  field: string
  level: 'warn' | 'bad'
  text: string
}

export function checkRules(config: Config): RuleTip[] {
  const tips: RuleTip[] = []
  const bay = Math.round(config.width / config.sections)
  if (bay < 350) tips.push({ field: 'sections', level: 'bad', text: `Секция ${bay} мм. Уже тесно. Уберите секцию.` })
  else if (bay < 400) tips.push({ field: 'sections', level: 'warn', text: `Секция ${bay} мм. Обычно от 400 мм.` })
  if (config.depth < 450 && config.doors !== 'open') {
    tips.push({ field: 'depth', level: 'warn', text: 'Глубина меньше 450 мм. Для одежды обычно от 500 мм.' })
  }
  if (config.height > 2500) {
    tips.push({ field: 'height', level: 'warn', text: 'Выше 2500 мм тяжело заносить и ставить.' })
  }
  if (config.doors === 'slide' && config.sections < 2) {
    tips.push({ field: 'doors', level: 'warn', text: 'Купе лучше от двух секций.' })
  }
  if (config.doors === 'open' && config.mirror !== 'none') {
    tips.push({ field: 'mirror', level: 'warn', text: 'Зеркало ставится на дверь. Включите двери.' })
  }
  if (config.mirror !== 'none' && config.frame === 'wide') {
    tips.push({ field: 'mirror', level: 'warn', text: 'Широкая рамка съест зеркало. Лучше узкая или гладкий.' })
  }
  return tips
}

export function tipFor(tips: RuleTip[], field: string) {
  return tips.find((tip) => tip.field === field) ?? null
}

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function clampInt(value: number, min: number, max: number) {
  return Math.round(clamp(value, min, max))
}

const handleIds = new Set(handles.map((item) => item.id))
const frameIds = new Set(frameModes.map((item) => item.id))
const mirrorIds = new Set(mirrorModes.map((item) => item.id))

export function sanitize(input: Config): Config {
  const next: Config = { ...defaultConfig, ...input }
  next.width = clamp(next.width, limits.width.min, limits.width.max)
  next.height = clamp(next.height, limits.height.min, limits.height.max)
  next.depth = clamp(next.depth, limits.depth.min, limits.depth.max)
  next.sections = clampInt(next.sections, limits.sections.min, limits.sections.max)
  next.shelves = clampInt(next.shelves, limits.shelves.min, limits.shelves.max)
  if (next.doors !== 'swing' && next.doors !== 'slide' && next.doors !== 'open') next.doors = 'swing'
  if (next.base !== 'plinth' && next.base !== 'legs') next.base = 'plinth'
  if (next.handlePos !== 'top' && next.handlePos !== 'middle' && next.handlePos !== 'bottom') next.handlePos = 'middle'
  if (next.handleSide !== 'open' && next.handleSide !== 'hinge') next.handleSide = 'open'
  if (!handleIds.has(next.handle)) next.handle = 'bar'
  if (!frameIds.has(next.frame)) {
    const legacy = next as Config & { facadeFrame?: boolean }
    next.frame = legacy.facadeFrame ? 'classic' : 'plain'
  }
  if (!mirrorIds.has(next.mirror)) next.mirror = 'none'
  if (next.doors === 'open') next.mirror = 'none'
  return next
}

export function readConfig(value: unknown): Config | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<Config>
  if (typeof raw.width !== 'number' && typeof (raw as { wardrobe?: { width?: number } }).wardrobe?.width !== 'number') {
    if (!('sections' in raw) && !('width' in raw)) return null
  }
  const flat = raw as Partial<Config>
  if (typeof flat.width !== 'number') return null
  return sanitize({ ...defaultConfig, ...flat })
}
