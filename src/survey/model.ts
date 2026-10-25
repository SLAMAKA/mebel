/** Замер проёма и конверт изделия. Размеры в миллиметрах. */

export const GAP_SIDE_MM = 10
export const GAP_TOP_MM = 15
export const GAP_BACK_MM = 10
export const SQUARE_TOL_MM = 10

export type Survey = {
  widthBottom: number
  widthMid: number
  widthTop: number
  heightLeft: number
  heightRight: number
  depth: number
  skirtingHeight: number
  skirtingWidth: number
  diagonalA: number | null
  diagonalB: number | null
}

export type Envelope = {
  openingW: number
  openingH: number
  openingD: number
  maxW: number
  maxH: number
  maxD: number
  skirtingHeight: number
  skirtingWidth: number
  outOfSquare: boolean
}

export type AxisLimit = { min: number; max: number; step: number }

export type BoxLimits = {
  width: AxisLimit
  height: AxisLimit
  depth: AxisLimit
}

export type SurveyFields = {
  widthBottom: string
  widthMid: string
  widthTop: string
  heightLeft: string
  heightRight: string
  depth: string
  skirtingHeight: string
  skirtingWidth: string
  diagonalA: string
  diagonalB: string
}

export const emptyFields: SurveyFields = {
  widthBottom: '',
  widthMid: '',
  widthTop: '',
  heightLeft: '',
  heightRight: '',
  depth: '',
  skirtingHeight: '0',
  skirtingWidth: '0',
  diagonalA: '',
  diagonalB: '',
}

export function envelopeOf(survey: Survey): Envelope {
  const openingW = Math.min(survey.widthBottom, survey.widthMid, survey.widthTop)
  const openingH = Math.min(survey.heightLeft, survey.heightRight)
  const openingD = survey.depth
  const left = survey.diagonalA
  const right = survey.diagonalB
  const outOfSquare = left != null && right != null && Math.abs(left - right) > SQUARE_TOL_MM
  return {
    openingW,
    openingH,
    openingD,
    maxW: openingW - GAP_SIDE_MM * 2,
    maxH: openingH - GAP_TOP_MM,
    maxD: openingD - GAP_BACK_MM,
    skirtingHeight: survey.skirtingHeight,
    skirtingWidth: survey.skirtingWidth,
    outOfSquare,
  }
}

export function limitsInOpening<T extends BoxLimits>(base: T, opening: Envelope | null): T {
  if (!opening) return base
  return {
    ...base,
    width: { ...base.width, max: Math.min(base.width.max, Math.floor(opening.maxW)) },
    height: { ...base.height, max: Math.min(base.height.max, Math.floor(opening.maxH)) },
    depth: { ...base.depth, max: Math.min(base.depth.max, Math.floor(opening.maxD)) },
  }
}

export function openingBlock(opening: Envelope, limits: BoxLimits) {
  if (opening.maxW < limits.width.min) {
    return `После запаса ширина ${opening.maxW} мм. Для изделия нужно от ${limits.width.min} мм.`
  }
  if (opening.maxH < limits.height.min) {
    return `После запаса высота ${opening.maxH} мм. Для изделия нужно от ${limits.height.min} мм.`
  }
  if (opening.maxD < limits.depth.min) {
    return `После запаса глубина ${opening.maxD} мм. Для изделия нужно от ${limits.depth.min} мм.`
  }
  return null
}

export function fitSpan(value: number, axis: AxisLimit, openingMax: number | null) {
  const max = openingMax == null ? axis.max : Math.min(axis.max, Math.floor(openingMax))
  const min = Math.min(axis.min, max)
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function fitBox(
  size: { width: number; height: number; depth: number },
  limits: BoxLimits,
  opening: Envelope | null,
) {
  return {
    width: fitSpan(size.width, limits.width, opening ? opening.maxW : null),
    height: fitSpan(size.height, limits.height, opening ? opening.maxH : null),
    depth: fitSpan(size.depth, limits.depth, opening ? opening.maxD : null),
  }
}

export function fitsOpening(
  patch: { width?: number; height?: number; depth?: number },
  opening: Envelope | null,
) {
  if (!opening) return true
  if (patch.width != null && patch.width > opening.maxW) return false
  if (patch.height != null && patch.height > opening.maxH) return false
  if (patch.depth != null && patch.depth > opening.maxD) return false
  return true
}

export function surveyLines(
  survey: Survey | null,
  size: { width: number; height: number; depth: number },
) {
  if (!survey) return []
  const opening = envelopeOf(survey)
  const lines = [
    { name: 'Проём', value: `${opening.openingW} × ${opening.openingH} × ${opening.openingD} мм` },
    { name: 'Чистовой габарит', value: `${size.width} × ${size.height} × ${size.depth} мм` },
  ]
  if (survey.skirtingHeight > 0 && survey.skirtingWidth > 0) {
    lines.push({ name: 'Плинтус', value: `${survey.skirtingHeight} × ${survey.skirtingWidth} мм` })
  }
  if (opening.outOfSquare) lines.push({ name: 'Угол', value: 'Проём не прямой' })
  return lines
}

export function fieldsFromSurvey(survey: Survey): SurveyFields {
  return {
    widthBottom: String(survey.widthBottom),
    widthMid: String(survey.widthMid),
    widthTop: String(survey.widthTop),
    heightLeft: String(survey.heightLeft),
    heightRight: String(survey.heightRight),
    depth: String(survey.depth),
    skirtingHeight: String(survey.skirtingHeight),
    skirtingWidth: String(survey.skirtingWidth),
    diagonalA: survey.diagonalA == null ? '' : String(survey.diagonalA),
    diagonalB: survey.diagonalB == null ? '' : String(survey.diagonalB),
  }
}

function readMm(raw: string) {
  const text = raw.trim().replace(',', '.')
  if (!text) return null
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max
}

export function surveyFromFields(fields: SurveyFields): { survey: Survey } | { error: string } {
  const widthBottom = readMm(fields.widthBottom)
  const widthMid = readMm(fields.widthMid)
  const widthTop = readMm(fields.widthTop)
  const heightLeft = readMm(fields.heightLeft)
  const heightRight = readMm(fields.heightRight)
  const depth = readMm(fields.depth)
  if (
    widthBottom == null ||
    widthMid == null ||
    widthTop == null ||
    heightLeft == null ||
    heightRight == null ||
    depth == null
  ) {
    return { error: 'Нужны три ширины две высоты и глубина.' }
  }
  if (![widthBottom, widthMid, widthTop].every((value) => inRange(value, 200, 8000))) {
    return { error: 'Ширина от 200 до 8000 мм.' }
  }
  if (![heightLeft, heightRight].every((value) => inRange(value, 200, 5000))) {
    return { error: 'Высота от 200 до 5000 мм.' }
  }
  if (!inRange(depth, 100, 2000)) return { error: 'Глубина от 100 до 2000 мм.' }

  const skirtingHeight = readSkirt(fields.skirtingHeight, 300)
  const skirtingWidth = readSkirt(fields.skirtingWidth, 100)
  if (skirtingHeight == null || skirtingWidth == null) {
    return { error: 'Плинтус: высота от 0 до 300 мм, ширина от 0 до 100 мм.' }
  }
  if ((skirtingHeight === 0) !== (skirtingWidth === 0)) {
    return { error: 'Для плинтуса нужны и высота и ширина. 0 и 0 — плинтуса нет.' }
  }

  const diagonalA = readMm(fields.diagonalA)
  const diagonalB = readMm(fields.diagonalB)
  if (fields.diagonalA.trim() && diagonalA == null) return { error: 'Диагональ должна быть числом.' }
  if (fields.diagonalB.trim() && diagonalB == null) return { error: 'Диагональ должна быть числом.' }

  return {
    survey: {
      widthBottom,
      widthMid,
      widthTop,
      heightLeft,
      heightRight,
      depth,
      skirtingHeight,
      skirtingWidth,
      diagonalA,
      diagonalB,
    },
  }
}

function pos(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function readSkirt(raw: string, max: number) {
  const text = raw.trim().replace(',', '.')
  if (!text) return 0
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0 || value > max) return null
  return Math.round(value)
}

function nonNeg(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

/** Читает замер из сохранённого файла или тела заказа. */
export function readSurvey(value: unknown): Survey | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const widthBottom = pos(raw.widthBottom)
  const widthMid = pos(raw.widthMid)
  const widthTop = pos(raw.widthTop)
  const heightLeft = pos(raw.heightLeft)
  const heightRight = pos(raw.heightRight)
  const depth = pos(raw.depth)
  if (
    widthBottom == null ||
    widthMid == null ||
    widthTop == null ||
    heightLeft == null ||
    heightRight == null ||
    depth == null
  ) return null
  const legacy = raw.skirting == null ? null : nonNeg(raw.skirting)
  if (raw.skirting != null && legacy == null) return null
  const skirtingHeight = raw.skirtingHeight == null
    ? (legacy ?? 0)
    : nonNeg(raw.skirtingHeight)
  const skirtingWidth = raw.skirtingWidth == null
    ? (legacy && legacy > 0 ? 16 : 0)
    : nonNeg(raw.skirtingWidth)
  if (skirtingHeight == null || skirtingWidth == null) return null
  const diagonalA = raw.diagonalA == null ? null : pos(raw.diagonalA)
  const diagonalB = raw.diagonalB == null ? null : pos(raw.diagonalB)
  if (raw.diagonalA != null && diagonalA == null) return null
  if (raw.diagonalB != null && diagonalB == null) return null
  return {
    widthBottom,
    widthMid,
    widthTop,
    heightLeft,
    heightRight,
    depth,
    skirtingHeight,
    skirtingWidth,
    diagonalA,
    diagonalB,
  }
}
