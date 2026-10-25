import { Choice, IconPick, Measure } from '../ui'
import { type Part } from '../geometry'
import {
  assignmentFor,
  copyPatternToKeys,
  frameInsetMm,
  hasFrame,
  patternApplyModes,
  patternModes,
  patternName,
  rippleDefaults,
  setPattern,
  type PatternApply,
  type PatternAssign,
  type PatternId,
} from './catalog'
import { PatternIcon } from './icons'
import { patternPaths } from './paths'

export function PatternPane({
  parts,
  patterns,
  pickedKey,
  frame,
  onChange,
}: {
  parts: Part[]
  patterns: PatternAssign[]
  pickedKey: string | null
  frame: string
  onChange: (patterns: PatternAssign[]) => void
}) {
  const facades = (parts ?? []).filter((part) => part.role === 'facade' && !part.ghost)
  const millable = facades.filter((part) => !part.mirror || part.mirror === 'none')
  const picked = facades.find((part) => part.key === pickedKey) ?? facades[0] ?? null
  const current = picked ? assignmentFor(patterns, picked.key) : null
  const minMargin = frameInsetMm(frame)
  const framed = hasFrame(frame)
  const thick = picked ? Math.round(picked.size[2] * 1000) : 18
  const maxDepth = Math.max(1, Math.min(8, thick - 4))
  const mirrored = Boolean(picked?.mirror && picked.mirror !== 'none')
  const paths = picked && current && current.id !== 'none' && !mirrored
    ? patternPaths(
      current.id,
      Math.round(picked.size[0] * 1000),
      Math.round(picked.size[1] * 1000),
      Math.max(current.margin, minMargin),
      current.step,
    )
    : []

  function patch(next: Partial<PatternAssign>) {
    if (!picked || !current) return
    const row = { ...current, ...next, partKey: picked.key }
    onChange(setPattern(patterns, row))
  }

  if (!picked || !current) {
    return <p className="tip warn">Нет фасада. Включите двери.</p>
  }
  if (mirrored) {
    return <p className="tip warn">На зеркале узор не ставим.</p>
  }

  return (
    <>
      <IconPick
        label="Шаблон"
        value={current.id}
        options={patternModes}
        render={(id) => <PatternIcon id={id} />}
        onChange={(id: PatternId) => {
          const extras = id === 'ripples' ? rippleDefaults(minMargin) : {}
          const margin = framed
            ? Math.max(current.margin, minMargin)
            : current.id === 'none' ? 0 : current.margin
          const row = { ...current, ...extras, id, margin, partKey: picked.key }
          if (id === 'ripples' && millable.length > 1) {
            onChange(copyPatternToKeys(row, millable.map((part) => part.key)))
            return
          }
          patch(row)
        }}
      />
      {current.id !== 'none' && (
        <>
          <Choice
            label="Как нанести"
            value={current.apply ?? 'surface'}
            options={patternApplyModes}
            onChange={(apply: PatternApply) => patch({ apply })}
          />
          {current.apply === 'mill' && (
            <Measure
              label="Глубина"
              value={Math.min(current.depth, maxDepth)}
              min={1}
              max={maxDepth}
              step={1}
              bump={1}
              onChange={(depth) => patch({ depth })}
            />
          )}
          {framed ? (
            <p className="door-place-hint">Узор внутри рамки · поле {minMargin} мм</p>
          ) : (
            <Measure
              label="Отступ"
              value={current.margin}
              min={0}
              max={160}
              step={1}
              bump={5}
              onChange={(margin) => patch({ margin })}
            />
          )}
          <Measure
            label="Шаг"
            value={current.step}
            min={16}
            max={160}
            step={1}
            bump={5}
            onChange={(step) => patch({ step })}
          />
          {millable.length > 1 && (
            <div className="row">
              <button
                type="button"
                className="ghost"
                onClick={() => onChange(copyPatternToKeys(current, millable.map((part) => part.key)))}
              >
                На все фасады
              </button>
            </div>
          )}
        </>
      )}
      {current.id !== 'none' && !paths.length && (
        <p className="tip warn">Узор не влезает. Уменьшите отступ или шаг.</p>
      )}
      {current.id !== 'none' && paths.length > 0 && (
        <p className="door-place-hint">
          {current.apply === 'surface'
            ? `${patternName(current.id)} на лице. В ЧПУ не идёт.`
            : current.apply === 'cut'
              ? `${patternName(current.id)} · сквозной вырез ЧПУ. Ручка-вырез остаётся.`
              : current.id === 'ripples'
                ? `Кольца на всю лицевую · шаг ${current.step} мм · рисунок идёт через стык`
                : `${patternName(current.id)} · выборка ${Math.min(current.depth, maxDepth)} мм`}
        </p>
      )}
    </>
  )
}
