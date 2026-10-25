import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  bases,
  colors,
  findById,
  type ColorId,
  type FrameId,
  type HandleId,
  type HandlePosId,
  type HandleSideId,
  type BaseId,
  type RuleTip,
} from './model'

export function Measure({
  label,
  value,
  min,
  max,
  step,
  unit = 'мм',
  bump,
  tip,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  bump?: number
  tip?: RuleTip | null
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const sent = useRef(value)
  const jump = bump ?? Math.max(step, unit === 'шт' ? 1 : 10)

  useEffect(() => {
    if (value === sent.current) return
    sent.current = value
    setText(String(value))
  }, [value])

  function push(next: number) {
    const clamped = Math.min(max, Math.max(min, next))
    const clean = step >= 1 ? Math.round(clamped) : clamped
    sent.current = clean
    setText(String(clean))
    onChange(clean)
  }

  function commit(raw: string) {
    const parsed = Number(raw.replace(',', '.'))
    push(Number.isFinite(parsed) ? parsed : value)
  }

  return (
    <div className={tip ? `measure has-tip ${tip.level}` : 'measure'}>
      <label className="measure-row">
        <span>{label}</span>
        <span className="measure-value">
          <button type="button" className="step" onClick={() => push(value - jump)} aria-label="меньше">−</button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => commit(text)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit(text)
            }}
          />
          <button type="button" className="step" onClick={() => push(value + jump)} aria-label="больше">+</button>
          <em>{unit}</em>
        </span>
      </label>
      {tip && <p className={`tip ${tip.level}`}>{tip.text}</p>}
    </div>
  )
}

export function Choice<T extends string>({
  label,
  value,
  options,
  tip,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; name: string }[]
  tip?: RuleTip | null
  onChange: (value: T) => void
}) {
  return (
    <div className={tip ? `choice has-tip ${tip.level}` : 'choice'}>
      <span className="choice-label">{label}</span>
      <div className="chips">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === value ? 'chip on' : 'chip'}
            onClick={() => onChange(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {tip && <p className={`tip ${tip.level}`}>{tip.text}</p>}
    </div>
  )
}

export function FrameIcon({ id }: { id: FrameId }) {
  if (id === 'plain') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
      </svg>
    )
  }
  if (id === 'thin') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <rect x="9" y="7" width="14" height="26" rx="0.5" />
      </svg>
    )
  }
  if (id === 'wide') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="5" y="3" width="22" height="34" rx="1" />
        <rect x="11" y="10" width="10" height="20" rx="0.5" />
      </svg>
    )
  }
  if (id === 'double') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="5" y="3" width="22" height="34" rx="1" />
        <rect x="8" y="6" width="16" height="28" rx="0.5" />
        <rect x="11" y="10" width="10" height="20" rx="0.5" />
      </svg>
    )
  }
  if (id === 'bevel') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="5" y="3" width="22" height="34" rx="1" />
        <path d="M9 8h14v24H9z" />
        <path d="M12 12h8v16h-8z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true">
      <rect x="5" y="3" width="22" height="34" rx="1" />
      <rect x="9" y="8" width="14" height="24" rx="0.5" />
      <rect x="11" y="11" width="10" height="18" rx="0.5" />
    </svg>
  )
}

export function MirrorIcon({ id }: { id: string }) {
  if (id === 'none') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M10 12l12 16M22 12L10 28" />
      </svg>
    )
  }
  if (id === 'full') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <rect x="9" y="7" width="14" height="26" rx="0.5" className="fill" />
      </svg>
    )
  }
  if (id === 'oval') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <ellipse cx="16" cy="16" rx="6" ry="8" className="fill" />
      </svg>
    )
  }
  if (id === 'strip') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <rect x="12" y="8" width="8" height="24" rx="0.5" className="fill" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true">
      <rect x="6" y="4" width="20" height="32" rx="1" />
      <rect x="10" y="10" width="12" height="20" rx="0.5" className="fill" />
    </svg>
  )
}

export function HandleIcon({ id, side }: { id: HandleId; side: HandleSideId }) {
  const atOpen = side === 'open'
  const hx = atOpen ? 21 : 11
  const bow = atOpen
    ? `M${hx} 11c4 2 4 8 0 10`
    : `M${hx} 11c-4 2-4 8 0 10`

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="8" y="4" width="16" height="24" rx="1" />
      <circle cx="9.5" cy="10" r="1" className="fill" />
      <circle cx="9.5" cy="22" r="1" className="fill" />
      {id === 'none' ? null : id === 'knob' ? (
        <circle cx={hx} cy="16" r="2.5" className="fill" />
      ) : id === 'rail' ? (
        <path d={atOpen ? 'M12 10h10' : 'M10 10h10'} />
      ) : id === 'bow' ? (
        <path d={bow} />
      ) : id === 'edge' ? (
        <path d={`M${hx} 8v16`} />
      ) : id === 'cut' ? (
        <rect x={atOpen ? 12 : 8} y="7" width="12" height="3.2" rx="1.6" className="fill" />
      ) : (
        <path d={`M${hx} 12v8`} />
      )}
    </svg>
  )
}

export function IconPick<T extends string>({
  label,
  value,
  options,
  tip,
  render,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; name: string }[]
  tip?: RuleTip | null
  render: (id: T) => ReactNode
  onChange: (value: T) => void
}) {
  const current = findById(options, value).name
  return (
    <div className={tip ? `choice has-tip ${tip.level}` : 'choice'}>
      <span className="choice-label">{label} · {current}</span>
      <div className="chips icon-chips">
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === value ? 'chip icon-chip tall on' : 'chip icon-chip tall'}
            aria-label={item.name}
            title={item.name}
            onClick={() => onChange(item.id)}
          >
            {render(item.id)}
          </button>
        ))}
      </div>
      {tip && <p className={`tip ${tip.level}`}>{tip.text}</p>}
    </div>
  )
}

function BaseIcon({ id }: { id: string }) {
  if (id === 'legs') {
    return (
      <svg viewBox="0 0 32 24" aria-hidden="true">
        <path d="M4 4h24v10H4z" />
        <path d="M8 14v8M24 14v8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true">
      <path d="M4 3h24v11H4z" />
      <path d="M6 14h20v6H6z" />
    </svg>
  )
}

export function HandlePlace({
  pos,
  side,
  onChange,
}: {
  pos: HandlePosId
  side: HandleSideId
  onChange: (next: { handlePos: HandlePosId; handleSide: HandleSideId }) => void
}) {
  const rows: HandlePosId[] = ['top', 'middle', 'bottom']
  const cols: HandleSideId[] = ['hinge', 'open']
  const rowName = { top: 'Верх', middle: 'Середина', bottom: 'Низ' }

  return (
    <div className="choice">
      <span className="choice-label">Позиция на двери</span>
      <div className="door-place">
        <div className="door-place-door">
          <span className="door-place-hinge" aria-hidden="true" />
          <span className="door-place-hinge low" aria-hidden="true" />
          {rows.map((row) =>
            cols.map((col) => {
              const on = pos === row && side === col
              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  className={on ? 'door-place-spot on' : 'door-place-spot'}
                  style={{
                    gridRow: row === 'top' ? 1 : row === 'middle' ? 2 : 3,
                    gridColumn: col === 'hinge' ? 1 : 2,
                  }}
                  aria-label={`${rowName[row]}, ${col === 'open' ? 'у открытия' : 'у петли'}`}
                  title={`${rowName[row]} · ${col === 'open' ? 'у открытия' : 'у петли'}`}
                  onClick={() => onChange({ handlePos: row, handleSide: col })}
                />
              )
            }),
          )}
        </div>
        <div className="door-place-legend">
          <span>петли</span>
          <span>открытие</span>
        </div>
        <p className="door-place-hint">
          {rowName[pos]} · {side === 'open' ? 'у края открытия' : 'у петли'} · сторона считается по каждой двери
        </p>
      </div>
    </div>
  )
}

export function BaseChoice({
  value,
  onChange,
}: {
  value: BaseId
  onChange: (value: BaseId) => void
}) {
  return (
    <div className="choice">
      <div className="chips icon-chips">
        {bases.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === value ? 'chip icon-chip on' : 'chip icon-chip'}
            aria-label={item.name}
            title={item.name}
            onClick={() => onChange(item.id)}
          >
            <BaseIcon id={item.id} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Swatches({
  label,
  value,
  onChange,
}: {
  label: string
  value: ColorId
  onChange: (value: ColorId) => void
}) {
  return (
    <div className="swatches">
      <span className="choice-label">{label} · {findById(colors, value).name}</span>
      <div className="swatch-row">
        {colors.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === value ? 'swatch on' : 'swatch'}
            style={{ background: item.hex }}
            aria-label={item.name}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function Fold({
  title,
  summary,
  children,
  wake,
}: {
  title: string
  summary?: string
  children: ReactNode
  wake?: string | null
}) {
  const [open, setOpen] = useState(false)
  const last = useRef(wake)
  useEffect(() => {
    if (wake && wake !== last.current) setOpen(true)
    last.current = wake
  }, [wake])
  return (
    <section className={open ? 'fold open' : 'fold'}>
      <button type="button" className="fold-head" onClick={() => setOpen((value) => !value)}>
        <span className="fold-title">
          {title}
          {!open && summary ? <em className="fold-summary">{summary}</em> : null}
        </span>
        <span className="fold-mark" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  )
}
