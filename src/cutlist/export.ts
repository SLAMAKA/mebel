import type { CutRow, MarkRow, TapeRow } from '../geometry'
import type { NestResult, NestSheet } from './nest'

function download(name: string, blob: Blob) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

const PIECE_FILL = ['#c4a36e', '#8ea394', '#6b8cae', '#b65d42', '#7a7f86', '#5b6b7c']

export function pieceFill(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i) * (i + 1)
  return PIECE_FILL[hash % PIECE_FILL.length]
}

/** Цех: детали кромка разметка. Excel и 1С открывают как таблицу. */
export function saveShopCsv(rows: CutRow[], tapes: TapeRow[], marks: MarkRow[]) {
  const head = ['Деталь', 'Материал', 'Длина', 'Ширина', 'Толщина', 'Кромка', 'Пил длина', 'Пил ширина', 'Количество']
  const lines = [head.join(';')]
  for (const row of rows) {
    lines.push([row.name, row.material, row.length, row.width, row.thick, row.edge, row.sawL, row.sawW, row.qty].join(';'))
  }
  lines.push('')
  lines.push('Кромка')
  for (const tape of tapes) {
    lines.push(`${tape.name};нужно ${tape.need} м;заказать ${tape.order} м`)
  }
  lines.push('')
  lines.push('Разметка')
  for (const mark of marks) {
    lines.push(`${mark.title};${mark.text}`)
  }
  download('raspil.csv', new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }))
}

/**
 * Раскройщик: Cutting / OptiCut / CutList Optimizer.
 * Длина и ширина в мм. Материал в отдельной колонке чтобы софт клал на свои листы.
 */
export function saveCutterCsv(rows: CutRow[]) {
  const head = ['Length', 'Width', 'Qty', 'Label', 'Bin', 'Material', 'Thickness']
  const lines = [head.join(';')]
  for (const row of rows) {
    lines.push([
      row.length,
      row.width,
      row.qty,
      row.name,
      `${row.material} ${row.thick}`,
      row.material,
      row.thick,
    ].join(';'))
  }
  download('raspil-cutting.csv', new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }))
}

function sheetGroup(sheet: NestSheet, sheetL: number, sheetW: number, y: number) {
  const parts = sheet.placements.map((piece) => {
    const fill = pieceFill(piece.name)
    const label = `${piece.name} ${Math.round(piece.w)}×${Math.round(piece.h)}`
    const show = piece.w > sheetL * 0.08 && piece.h > sheetW * 0.08
    const text = show
      ? `<text x="${piece.x + piece.w / 2}" y="${piece.y + piece.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(piece.w, piece.h) * 0.12}" fill="#241c16">${escapeXml(label)}</text>`
      : ''
    return `<g><rect x="${piece.x}" y="${piece.y}" width="${piece.w}" height="${piece.h}" fill="${fill}" stroke="#241c16" stroke-width="2"/><title>${escapeXml(label)}</title>${text}</g>`
  })
  return `<g transform="translate(0 ${y})">
    <rect x="0" y="0" width="${sheetL}" height="${sheetW}" fill="#e8e0d4" stroke="#6d5848" stroke-width="4"/>
    ${parts.join('')}
  </g>`
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Карты листов одним SVG. Печать и отправка в цех без лишнего софта. */
export function saveNestSvg(nest: NestResult) {
  const gap = 80
  const height = nest.sheets.reduce((sum, _sheet, index) => {
    return sum + nest.sheetW + (index < nest.sheets.length - 1 ? gap : 0)
  }, 0)
  let y = 0
  const bodies: string[] = []
  for (const sheet of nest.sheets) {
    bodies.push(sheetGroup(sheet, nest.sheetL, nest.sheetW, y))
    y += nest.sheetW + gap
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${nest.sheetL} ${Math.max(height, nest.sheetW)}" width="${nest.sheetL}" height="${Math.max(height, nest.sheetW)}">
  ${bodies.join('\n')}
</svg>`
  download('raspil-karty.svg', new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
}
