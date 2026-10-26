import { useState, type KeyboardEvent } from 'react'
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
  assignmentFor,
  frameInsetMm,
  hasFrame,
  patternName,
  type PatternAssign,
} from '../pattern/catalog'
import { PatternPane } from '../pattern/section'
import { type Part } from '../geometry'
import {
  Choice,
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

const features: { id: Feature; empty: string }[] = [
  { id: 'handle', empty: 'Ручка' },
  { id: 'frame', empty: 'Рамка' },
  { id: 'pattern', empty: 'Узор' },
]

function facadeParts(parts: Part[]) {
  return parts.filter((part) => part.role === 'facade' && !part.ghost)
}

function clampPatterns(patterns: PatternAssign[], frame: FrameId) {
  if (!hasFrame(frame)) return patterns
  const inset = frameInsetMm(frame)
  return patterns.map((row) => ({ ...row, margin: Math.max(row.margin, inset) }))
}

function featureLabel(id: Feature, look: FacadeLook, partKey: string) {
  if (id === 'handle') {
    return look.handle === 'none' ? 'Ручка' : findById(handles, look.handle).name
  }
  if (id === 'frame') {
    return look.frame === 'plain' ? 'Рамка' : findById(frameModes, look.frame).name
  }
  const row = assignmentFor(look.patterns, partKey)
  return row.id === 'none' ? 'Узор' : patternName(row.id)
}

function isEmpty(id: Feature, look: FacadeLook, partKey: string) {
  if (id === 'handle') return look.handle === 'none'
  if (id === 'frame') return look.frame === 'plain'
  return assignmentFor(look.patterns, partKey).id === 'none'
}

export function FacadeBar({
  parts,
  pickedKey,
  look,
  onLook,
  handleLayout,
  showMirror,
  open,
  onToggle,
}: {
  parts: Part[]
  pickedKey: string
  look: FacadeLook
  onLook: (next: FacadeLook) => void
  handleLayout: 'place' | 'height'
  showMirror?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  const [feature, setFeature] = useState<Feature | null>(null)
  const facades = facadeParts(parts)
  const picked = facades.find((part) => part.key === pickedKey)
  if (!picked) return null

  function patch(next: Partial<FacadeLook>) {
    onLook({ ...look, ...next })
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = Math.max(0, features.findIndex((item) => item.id === feature))
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setFeature(features[(index + 1) % features.length].id)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFeature(features[(index - 1 + features.length) % features.length].id)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setFeature(null)
    }
  }

  return (
    <div className="face-bar">
      <div className="face-bar-row">
        <div
          className="face-bar-tabs"
          role="tablist"
          aria-label="Фасад"
          onKeyDown={onTabKey}
        >
          {features.map((item) => {
            const on = item.id === feature
            const empty = isEmpty(item.id, look, picked.key)
            const label = featureLabel(item.id, look, picked.key)
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`face-tab-${item.id}`}
                aria-selected={on}
                aria-controls={on ? `face-pane-${item.id}` : undefined}
                aria-label={empty ? item.empty : label}
                tabIndex={on || feature == null ? 0 : -1}
                className={on ? 'on' : empty ? 'mute' : undefined}
                onClick={() => setFeature(on ? null : item.id)}
              >
                {label}
              </button>
            )
          })}
        </div>
        {picked.move && onToggle && (
          <button
            type="button"
            className={open ? 'face-move on' : 'face-move'}
            aria-pressed={Boolean(open)}
            onClick={onToggle}
          >
            {open ? 'Закрыть' : 'Открыть'}
          </button>
        )}
      </div>

      {feature === 'handle' && (
        <div className="face-bar-pane" role="tabpanel" id="face-pane-handle" aria-labelledby="face-tab-handle">
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
        <div className="face-bar-pane" role="tabpanel" id="face-pane-frame" aria-labelledby="face-tab-frame">
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
              value={look.mirror ?? 'none'}
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
        <div className="face-bar-pane" role="tabpanel" id="face-pane-pattern" aria-labelledby="face-tab-pattern">
          <PatternPane
            parts={parts}
            patterns={look.patterns}
            pickedKey={picked.key}
            frame={look.frame}
            onChange={(patterns) => patch({ patterns })}
          />
        </div>
      )}
    </div>
  )
}
