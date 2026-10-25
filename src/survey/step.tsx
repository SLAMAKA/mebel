import { useEffect, useMemo, useState } from 'react'
import {
  emptyFields,
  envelopeOf,
  fieldsFromSurvey,
  GAP_BACK_MM,
  GAP_SIDE_MM,
  GAP_TOP_MM,
  openingBlock,
  surveyFromFields,
  type BoxLimits,
  type Survey,
  type SurveyFields,
} from './model'
import { SurveyMarks } from './marks'

export function useOpening() {
  const [phase, setPhase] = useState<'survey' | 'design'>('survey')
  const [fields, setFields] = useState<SurveyFields>(emptyFields)
  const [survey, setSurvey] = useState<Survey | null>(null)
  const opening = useMemo(() => (survey ? envelopeOf(survey) : null), [survey])

  function skip() {
    setSurvey(null)
    setPhase('design')
  }

  function accept(next: Survey) {
    setSurvey(next)
    setFields(fieldsFromSurvey(next))
    setPhase('design')
    return envelopeOf(next)
  }

  function edit() {
    if (survey) setFields(fieldsFromSurvey(survey))
    setPhase('survey')
  }

  return { phase, fields, setFields, survey, opening, skip, accept, edit }
}

export function SurveyStep({
  mode,
  title,
  fields,
  limits,
  onChange,
  onSkip,
  onDone,
}: {
  mode: 'niche' | 'free'
  title: string
  fields: SurveyFields
  limits: BoxLimits
  onChange: (fields: SurveyFields) => void
  onSkip: () => void
  onDone: (survey: Survey) => void
}) {
  const [error, setError] = useState('')
  const [open, setOpen] = useState(true)
  const parsed = surveyFromFields(fields)
  const opening = 'survey' in parsed ? envelopeOf(parsed.survey) : null
  const block = opening ? openingBlock(opening, limits) : null

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function setField(key: keyof SurveyFields, value: string) {
    setError('')
    onChange({ ...fields, [key]: value })
  }

  function submit() {
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    if (block) {
      setError(block)
      return
    }
    onDone(parsed.survey)
  }

  const lead = mode === 'niche'
    ? 'Ниша на картинке. Ткни размер и впиши миллиметры.'
    : 'Можно пропустить. Или ткни размер на картинке и впиши проём.'

  return (
    <div className={open ? 'app survey-app' : 'app survey-app sidebar-shut'}>
      <aside className={open ? 'panel sidebar open' : 'panel sidebar'} aria-label="Замер">
        <div className="brand">
          <div>
            <h1>{title}</h1>
            <p>Замер</p>
          </div>
          <button
            type="button"
            className="ghost sidebar-close"
            aria-label="Скрыть панель"
            onClick={() => setOpen(false)}
          >
            Скрыть
          </button>
        </div>
        <p className="survey-lead">{lead}</p>
        <p className="survey-meta">
          Запас {GAP_SIDE_MM} мм сбоку · {GAP_TOP_MM} мм сверху · {GAP_BACK_MM} мм сзади
        </p>
        <div className="survey-skirt">
          <p className="survey-kicker">Плинтус</p>
          <label className="survey-field">
            <span>Высота</span>
            <input
              inputMode="decimal"
              aria-label="Высота плинтуса"
              value={fields.skirtingHeight}
              placeholder="0"
              onChange={(event) => setField('skirtingHeight', event.target.value)}
            />
          </label>
          <label className="survey-field">
            <span>Ширина</span>
            <input
              inputMode="decimal"
              aria-label="Ширина плинтуса"
              value={fields.skirtingWidth}
              placeholder="0"
              onChange={(event) => setField('skirtingWidth', event.target.value)}
            />
          </label>
          <p className="survey-lead">0 — плинтуса нет. Ширина это выступ от стены.</p>
        </div>
        {opening && (
          <p className="survey-readout">
            Проём {opening.openingW} × {opening.openingH} × {opening.openingD} мм
            <span>Изделие до {opening.maxW} × {opening.maxH} × {opening.maxD} мм</span>
          </p>
        )}
        {opening?.outOfSquare && <p className="warn">Проём не прямой. Корпус останется прямоугольным.</p>}
        {(error || block) && <p className="warn">{error || block}</p>}
        <div className="survey-actions">
          <button type="button" className="chip on" onClick={submit}>Дальше к дизайну</button>
          <button type="button" className="ghost" onClick={onSkip}>Без привязки к месту</button>
        </div>
      </aside>
      {!open && (
        <button type="button" className="sidebar-open" onClick={() => setOpen(true)}>Замер</button>
      )}
      <main className="view">
        <SurveyMarks fields={fields} onChange={setField} />
      </main>
    </div>
  )
}

export function PlaceBar({
  survey,
  onEdit,
  onOrder,
  ordering,
  orderNote,
}: {
  survey: Survey | null
  onEdit: () => void
  onOrder: () => void
  ordering: boolean
  orderNote: string
}) {
  const opening = survey ? envelopeOf(survey) : null
  return (
    <div className="place-bar">
      <p className="readout">
        {opening
          ? `Проём ${opening.openingW} × ${opening.openingH} × ${opening.openingD} мм`
          : 'Без привязки к месту'}
      </p>
      {opening?.outOfSquare && <p className="warn">Проём не прямой</p>}
      <div className="row">
        <button type="button" className="ghost" onClick={onEdit}>Замер</button>
        <button type="button" className="ghost" onClick={onOrder} disabled={ordering}>
          {ordering ? 'Считаю…' : 'В заказ'}
        </button>
      </div>
      {orderNote && <p className="note">{orderNote}</p>}
    </div>
  )
}
