import { compile, type Compiled } from '../geometry'
import { compileMini } from '../mini/geometry'
import { defaultMiniConfig, sanitizeMini, type MiniConfig } from '../mini/model'
import { defaultsByKind, sanitize, type Config } from '../model'
import { compileShoe } from '../shoe/geometry'
import { defaultShoeConfig, sanitizeShoe, type ShoeConfig } from '../shoe/model'
import { envelopeOf, readSurvey, type Survey } from '../survey/model'

export const ENGINE = '1'

export type OrderInput = {
  kind: string
  survey: unknown
  config: unknown
}

export type OrderSnapshot = {
  id: string
  at: string
  engine: string
  kind: string
  survey: Survey | null
  config: Config | ShoeConfig | MiniConfig
  spec: Compiled['spec']
  cuts: Compiled['cuts']
  tapes: Compiled['tapes']
  marks: Compiled['marks']
  nest: Compiled['nest']
}

function pack(
  kind: string,
  survey: Survey | null,
  config: Config | ShoeConfig | MiniConfig,
  compiled: Compiled,
): OrderSnapshot {
  return {
    id: `order-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    engine: ENGINE,
    kind,
    survey,
    config,
    spec: compiled.spec,
    cuts: compiled.cuts,
    tapes: compiled.tapes,
    marks: compiled.marks,
    nest: compiled.nest,
  }
}

/** Фиксирует заказ теми же формулами что и экран. Картинку при движении слайдера не считает. */
export function lockOrder(input: OrderInput): OrderSnapshot {
  if (!input || typeof input.config !== 'object' || input.config == null) {
    throw new Error('Нет изделия')
  }
  let survey: Survey | null = null
  if (input.survey != null) {
    survey = readSurvey(input.survey)
    if (!survey) throw new Error('Замер не читается')
  }
  const opening = survey ? envelopeOf(survey) : null
  const kind = input.kind

  if (kind === 'shoe') {
    const config = sanitizeShoe({ ...defaultShoeConfig, ...(input.config as ShoeConfig) }, opening)
    return pack(kind, survey, config, compileShoe(config, survey))
  }
  if (kind === 'mini') {
    const config = sanitizeMini({ ...defaultMiniConfig, ...(input.config as MiniConfig) }, opening)
    return pack(kind, survey, config, compileMini(config, survey))
  }
  if (kind === 'wardrobe' || kind === 'pedestal') {
    const config = sanitize({
      ...defaultsByKind[kind],
      ...(input.config as Config),
      kind,
    }, opening)
    return pack(kind, survey, config, compile(config, survey))
  }
  throw new Error('Неизвестный тип изделия')
}
