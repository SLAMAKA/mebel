import { useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  findById,
  finishes,
  frameModes,
  handles,
  mirrorModes,
  type FinishId,
  type FrameId,
  type HandleId,
  type HandlePosId,
  type HandleSideId,
  type MirrorId,
} from '../model'
import {
  frameInsetMm,
  hasFrame,
  patternSummary,
  type PatternAssign,
} from '../pattern/catalog'
import { PatternPane } from '../pattern/section'
import { partLabel, type Part } from '../geometry'
import {
  Choice,
  Fold,
  FrameIcon,
  HandleIcon,
  HandlePlace,
  IconPick,
  MirrorIcon,
} from '../ui'

export type FacadeLook = {
  frame: FrameId
  handle: HandleId
  handlePos: HandlePosId
  handleSide: HandleSideId
  finish: FinishId
  mirror?: MirrorId
  patterns: PatternAssign[]
}

type Feature = 'handle' | 'frame' | 'pattern'

const features: { id: Feature; name: string }[] = [
  { id: 'handle', name: 'Ручка' },
  { id: 'frame', name: 'Рамка' },
  { id: 'pattern', name: 'Узор' },
]

function facadeParts(parts: Part[]) {
  return parts.filter((part) => part.role === 'facade' && !part.ghost)
}

function facadeTitle(part: Part, index: number) {
  return `${partLabel(part)} ${index + 1}`
}

function clampPatterns(patterns: PatternAssign[], frame: FrameId) {
  if (!hasFrame(frame)) return patterns
  const inset = frameInsetMm(frame)
  return patterns.map((row) => ({ ...row, margin: Math.max(row.margin, inset) }))
}

export function FacadeSection({
  title,
  parts,
  pickedKey,
  onPick,
  look,
  onLook,
  header,
  locked,
  showMirror,
  handleLayout,
}: {
  title: string
  parts: Part[]
  pickedKey: string | null
  onPick: (key: string) => void
  look: FacadeLook
  onLook: (next: FacadeLook) => void
  header?: ReactNode
  locked?: boolean
  showMirror?: boolean
  handleLayout: 'place' | 'height'
}) {
  const [feature, setFeature] = useState<Feature>('handle')
  const facades = facadeParts(parts ?? [])
  const picked = facades.find((part) => part.key === pickedKey) ?? facades[0] ?? null
  const summary = [
    findById(handles, look.handle).name,
    findById(frameModes, look.frame).name,
    patternSummary(look.patterns),
  ].join(' · ')

  function patch(next: Partial<FacadeLook>) {
    onLook({ ...look, ...next })
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = features.findIndex((item) => item.id === feature)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setFeature(features[(index + 1) % features.length].id)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFeature(features[(index - 1 + features.length) % features.length].id)
    }
  }

  return (
    <Fold title={title} summary={summary} wake={pickedKey}>
      {header}
      {locked ? (
        <p className="door-place-hint">Без фасада. Сначала выбери двери.</p>
      ) : !facades.length ? (
        <p className="tip warn">Нет фасада. Включите двери.</p>
      ) : (
        <>
          {facades.length > 1 && (
            <div className="choice">
              <span className="choice-label">Щит</span>
              <div className="chips">
                {facades.map((part, index) => (
                  <button
                    key={part.key}
                    type="button"
                    className={part.key === picked?.key ? 'chip on' : 'chip'}
                    onClick={() => onPick(part.key)}
                  >
                    {facadeTitle(part, index)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="door-place-hint">Ткни фасад на сцене. Потом ручку рамку или узор.</p>
          <div
            className="face-tabs"
            role="tablist"
            aria-label="Фичи фасада"
            onKeyDown={onTabKey}
          >
            {features.map((item) => {
              const on = item.id === feature
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`face-tab-${item.id}`}
                  aria-selected={on}
                  aria-controls={`face-pane-${item.id}`}
                  tabIndex={on ? 0 : -1}
                  className={on ? 'chip on' : 'chip'}
                  onClick={() => setFeature(item.id)}
                >
                  {item.name}
                </button>
              )
            })}
          </div>

          {feature === 'handle' && (
            <div className="face-pane" role="tabpanel" id="face-pane-handle" aria-labelledby="face-tab-handle">
              <IconPick
                label="Ручка"
                value={look.handle}
                options={handles}
                render={(id) => <HandleIcon id={id} side={look.handleSide} />}
                onChange={(handle: HandleId) => patch({
                  handle,
                  handlePos: handle === 'cut' ? 'top' : look.handlePos,
                })}
              />
              {look.handle !== 'none' && handleLayout === 'place' && (
                <HandlePlace
                  pos={look.handlePos}
                  side={look.handleSide}
                  onChange={(next) => patch(next)}
                />
              )}
              {look.handle !== 'none' && handleLayout === 'height' && (
                <Choice
                  label="Высота ручки"
                  value={look.handlePos}
                  options={[
                    { id: 'top', name: 'Верх' },
                    { id: 'middle', name: 'Середина' },
                    { id: 'bottom', name: 'Низ' },
                  ]}
                  onChange={(handlePos: HandlePosId) => patch({ handlePos })}
                />
              )}
              {look.handle !== 'none' && look.handle !== 'cut' && (
                <Choice
                  label="Покрытие"
                  value={look.finish}
                  options={finishes}
                  onChange={(finish: FinishId) => patch({ finish })}
                />
              )}
            </div>
          )}

          {feature === 'frame' && (
            <div className="face-pane" role="tabpanel" id="face-pane-frame" aria-labelledby="face-tab-frame">
              <IconPick
                label="Рамка"
                value={look.frame}
                options={frameModes}
                render={(id) => <FrameIcon id={id} />}
                onChange={(frame: FrameId) => patch({
                  frame,
                  patterns: clampPatterns(look.patterns, frame),
                })}
              />
              {showMirror && (
                <IconPick
                  label="Зеркало"
                  value={look.mirror}
                  options={mirrorModes}
                  render={(id) => <MirrorIcon id={id} />}
                  onChange={(mirror: MirrorId) => patch({ mirror })}
                />
              )}
              <p className="door-place-hint">
                {hasFrame(look.frame)
                  ? `Узор пойдёт внутрь рамки · поле ${frameInsetMm(look.frame)} мм`
                  : 'Гладкий щит. Узор на всю лицевую.'}
              </p>
            </div>
          )}

          {feature === 'pattern' && (
            <div className="face-pane" role="tabpanel" id="face-pane-pattern" aria-labelledby="face-tab-pattern">
              <PatternPane
                parts={parts}
                patterns={look.patterns}
                pickedKey={picked?.key ?? null}
                frame={look.frame}
                onChange={(patterns) => patch({ patterns })}
              />
            </div>
          )}
        </>
      )}
    </Fold>
  )
}
