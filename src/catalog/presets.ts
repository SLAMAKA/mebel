/**
 * Расширенный каталог типовых корпусов.
 * Идеи типов (base / wall / tall / vanity / wardrobe) — из open-source cabinet planners.
 */

export type CatalogPatch = {
  width?: number
  height?: number
  depth?: number
  sections?: number
  shelves?: number
  drawers?: number
  doors?: 'swing' | 'slide' | 'open'
  mirror?: 'none' | 'full' | 'panel' | 'oval' | 'strip'
  frame?: 'plain' | 'thin' | 'classic' | 'wide' | 'double' | 'bevel'
  handle?: 'bar' | 'knob' | 'rail' | 'bow' | 'edge' | 'none'
  runner?: 'ball' | 'roller' | 'hidden'
  base?: 'plinth' | 'legs'
}

export type CatalogPreset = {
  name: string
  patch: CatalogPatch
}

export const catalogPresets: Record<'wardrobe' | 'pedestal', CatalogPreset[]> = {
  wardrobe: [
    { name: 'Узкий 60', patch: { width: 600, height: 2100, depth: 520, sections: 1, shelves: 4, doors: 'swing', mirror: 'none' } },
    { name: 'Стандарт 120', patch: { width: 1200, height: 2200, depth: 560, sections: 2, shelves: 3, doors: 'swing', mirror: 'none' } },
    { name: 'С зеркалом', patch: { width: 1200, height: 2200, depth: 560, sections: 2, shelves: 3, doors: 'swing', mirror: 'full', frame: 'thin', handle: 'edge' } },
    { name: 'Широкий 180', patch: { width: 1800, height: 2400, depth: 600, sections: 3, shelves: 4, doors: 'slide', mirror: 'none' } },
    { name: 'Платяной 90', patch: { width: 900, height: 2400, depth: 600, sections: 1, shelves: 2, doors: 'swing', mirror: 'none', handle: 'rail' } },
    { name: 'Купе 160', patch: { width: 1600, height: 2400, depth: 600, sections: 2, shelves: 4, doors: 'slide', mirror: 'panel', frame: 'thin' } },
    { name: 'Wall 80', patch: { width: 800, height: 720, depth: 320, sections: 1, shelves: 2, doors: 'swing', mirror: 'none', handle: 'knob', base: 'plinth' } },
    { name: 'Tall 60', patch: { width: 600, height: 2000, depth: 400, sections: 1, shelves: 5, doors: 'swing', mirror: 'none', handle: 'bar' } },
  ],
  pedestal: [
    { name: 'Прикроватная', patch: { width: 450, height: 500, depth: 400, sections: 1, drawers: 2, shelves: 0, runner: 'ball' } },
    { name: 'ТВ 80', patch: { width: 800, height: 500, depth: 420, sections: 1, drawers: 2, shelves: 0, runner: 'ball' } },
    { name: 'Три ящика', patch: { width: 800, height: 720, depth: 450, sections: 1, drawers: 3, shelves: 0, runner: 'ball' } },
    { name: 'Двойная', patch: { width: 1000, height: 700, depth: 450, sections: 2, drawers: 3, shelves: 0, runner: 'ball' } },
    { name: 'Тумба base 60', patch: { width: 600, height: 720, depth: 560, sections: 1, drawers: 3, shelves: 0, runner: 'hidden', base: 'plinth' } },
    { name: 'Vanity 80', patch: { width: 800, height: 800, depth: 480, sections: 1, drawers: 2, shelves: 0, runner: 'ball', handle: 'knob' } },
    { name: 'Комод 4', patch: { width: 900, height: 900, depth: 450, sections: 1, drawers: 4, shelves: 0, runner: 'roller' } },
    { name: 'ТВ широкая', patch: { width: 1400, height: 480, depth: 400, sections: 2, drawers: 2, shelves: 0, runner: 'ball' } },
  ],
}

export type ShoeCatalogPreset = {
  name: string
  hint: string
  patch: {
    width?: number
    height?: number
    depth?: number
    drawers?: number
    rows?: number
  }
}

export const shoeCatalogPresets: ShoeCatalogPreset[] = [
  { name: 'ОБ-5 / 4', hint: '1500×600×280', patch: { width: 600, height: 1500, depth: 280, drawers: 4, rows: 2 } },
  { name: 'Компакт 3', hint: '1140×600×280', patch: { width: 600, height: 1140, depth: 280, drawers: 3, rows: 2 } },
  { name: 'Высокая 5', hint: '1860×600×300', patch: { width: 600, height: 1860, depth: 300, drawers: 5, rows: 2 } },
  { name: 'Широкая 2', hint: '780×800×280', patch: { width: 800, height: 780, depth: 280, drawers: 2, rows: 2 } },
]

export function catalogFor(kind: 'wardrobe' | 'pedestal') {
  return catalogPresets[kind] ?? catalogPresets.wardrobe
}

export function presetSizeHint(patch: CatalogPatch) {
  if (!patch.width || !patch.height || !patch.depth) return ''
  return `${patch.width}×${patch.height}×${patch.depth}`
}
