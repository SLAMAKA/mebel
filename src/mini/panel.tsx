import { useRef } from 'react'
import type { SpecRow } from '../geometry'
import type { NestResult } from '../cutlist/nest'
import { CutlistEntry } from '../cutlist/page'
import { boards } from '../model'
import {
  BaseChoice,
  Choice,
  Fold,
  Measure,
  Swatches,
} from '../ui'
import { envelopeOf, fitsOpening, limitsInOpening, type Survey } from '../survey/model'
import { PlaceBar } from '../survey/step'
import {
  applyMiniVariant,
  checkMiniRules,
  miniFronts,
  miniLegs,
  miniLimits,
  miniMounts,
  miniSummary,
  miniVariants,
  tipForMini,
  type MiniConfig,
  type MiniLegId,
  type MiniVariantId,
} from './model'

function LegIcon({ id }: { id: MiniLegId }) {
  if (id === 'round') {
    return (
      <svg viewBox="0 0 32 24" aria-hidden="true">
        <path d="M6 4h20v8H6z" />
        <rect x="9" y="12" width="4" height="9" rx="2" />
        <rect x="19" y="12" width="4" height="9" rx="2" />
      </svg>
    )
  }
  if (id === 'pin') {
    return (
      <svg viewBox="0 0 32 24" aria-hidden="true">
        <path d="M6 4h20v8H6z" />
        <path d="M11 12v9M21 12v9" />
      </svg>
    )
  }
  if (id === 'hairpin') {
    return (
      <svg viewBox="0 0 32 24" aria-hidden="true">
        <path d="M6 4h20v8H6z" />
        <path d="M10 12l-2 9M22 12l2 9" />
      </svg>
    )
  }
  if (id === 'block') {
    return (
      <svg viewBox="0 0 32 24" aria-hidden="true">
        <path d="M5 3h22v9H5z" />
        <path d="M8 12h5v9H8zM19 12h5v9h-5z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 24" aria-hidden="true">
      <path d="M6 4h20v8H6z" />
      <path d="M9 12h4v9H9zM19 12h4v9h-4z" />
    </svg>
  )
}

export function MiniPanel({
  config,
  spec,
  nest,
  note,
  place,
  onChange,
  onOpenAll,
  onCloseAll,
  onLoad,
  onCutlist,
  onHide,
}: {
  config: MiniConfig
  spec: SpecRow[]
  nest: NestResult
  note: string
  place: {
    survey: Survey | null
    onEdit: () => void
  }
  onChange: (config: MiniConfig) => void
  onOpenAll: () => void
  onCloseAll: () => void
  onLoad: (file: File) => void
  onCutlist: () => void
  onHide: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const rules = checkMiniRules(config)
  const tip = (field: string) => tipForMini(rules, field)
  const opening = place.survey ? envelopeOf(place.survey) : null
  const lim = limitsInOpening(miniLimits, opening)
  const summary = miniSummary(config)
  const sizeSummary = `${config.width} × ${config.height} × ${config.depth} · ${config.sections} сек.`

  function pickVariant(id: MiniVariantId) {
    onChange(applyMiniVariant(config, id))
  }

  function save() {
    const blob = new Blob([JSON.stringify({ kind: 'mini', ...config, survey: place.survey }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'mini.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <aside className="panel sidebar" aria-label="Мини">
      <div className="brand">
        <div>
          <h1>Мини</h1>
          <p>Мини-шкафчик</p>
        </div>
        <button
          type="button"
          className="ghost sidebar-close"
          aria-label="Скрыть панель"
          onClick={onHide}
        >
          Скрыть
        </button>
      </div>

      <PlaceBar
        survey={place.survey}
        onEdit={place.onEdit}
      />

      <p className="readout">
        {summary.variant} · {config.width} × {config.height} × {config.depth} мм · {summary.color}
      </p>

      <Fold title="Вариант" summary={`${summary.variant} · ${summary.mount}`}>
        <div className="variant-grid">
          {miniVariants.map((item) => {
            const ok = fitsOpening(item.patch, opening)
            return (
            <button
              key={item.id}
              type="button"
              className={item.id === config.variant ? 'variant on' : 'variant'}
              disabled={!ok}
              title={ok ? undefined : 'Не входит в проём'}
              onClick={() => {
                if (ok) pickVariant(item.id)
              }}
            >
              <strong>{item.name}</strong>
              <span>{item.hint}</span>
            </button>
            )
          })}
        </div>
      </Fold>

      <Fold title="Размеры" summary={sizeSummary}>
        {rules.length > 0 && (
          <ul className="rules">
            {rules.map((item) => (
              <li key={`${item.field}-${item.text}`} className={item.level}>{item.text}</li>
            ))}
          </ul>
        )}
        <Choice
          label="Крепление"
          value={config.mount}
          options={miniMounts}
          onChange={(mount) => onChange({
            ...config,
            mount,
            ...(mount === 'wall' ? { base: 'plinth' as const } : {}),
          })}
        />
        <Measure label="Ширина" value={config.width} {...lim.width} tip={tip('width')} onChange={(width) => onChange({ ...config, width })} />
        <Measure label="Высота" value={config.height} {...lim.height} tip={tip('height')} onChange={(height) => onChange({ ...config, height })} />
        <Measure label="Глубина" value={config.depth} {...lim.depth} tip={tip('depth')} onChange={(depth) => onChange({ ...config, depth })} />
        <Measure label="Секции" unit="шт" value={config.sections} {...miniLimits.sections} tip={tip('sections')} onChange={(sections) => onChange({ ...config, sections })} />
        <Measure
          label="Полки"
          unit="шт"
          value={config.shelves}
          {...miniLimits.shelves}
          tip={tip('shelves')}
          onChange={(shelves) => onChange({ ...config, shelves })}
        />
      </Fold>

      {config.mount === 'floor' && (
        <Fold
          title="Опора"
          summary={config.base === 'legs' ? `Ножки · ${summary.leg}` : 'Цоколь'}
        >
          <BaseChoice
            value={config.base}
            onChange={(base) => onChange({ ...config, base })}
          />
          {config.base === 'legs' && (
            <div className="choice">
              <span className="choice-label">Ножки · {summary.leg}</span>
              <div className="chips icon-chips">
                {miniLegs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === config.leg ? 'chip icon-chip on' : 'chip icon-chip'}
                    aria-label={item.name}
                    title={item.name}
                    onClick={() => onChange({ ...config, leg: item.id })}
                  >
                    <LegIcon id={item.id} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Fold>
      )}

      <Fold
        title="Цвет"
        summary={`фасад ${summary.color}`}
      >
        <Swatches label="Фасад" value={config.facadeColor} onChange={(facadeColor) => onChange({ ...config, facadeColor })} />
        <Swatches label="Корпус" value={config.carcassColor} onChange={(carcassColor) => onChange({ ...config, carcassColor })} />
      </Fold>

      <Fold title="Ещё">
        <Choice
          label="Тип фасада"
          value={config.front}
          options={miniFronts}
          tip={tip('front')}
          onChange={(front) => onChange({ ...config, front })}
        />
        <Choice label="Плита корпуса" value={config.carcassBoard} options={boards} onChange={(carcassBoard) => onChange({ ...config, carcassBoard })} />
        <Choice label="Плита фасада" value={config.facadeBoard} options={boards} onChange={(facadeBoard) => onChange({ ...config, facadeBoard })} />
        <div className="row">
          <button type="button" className="ghost" onClick={onOpenAll}>Открыть</button>
          <button type="button" className="ghost" onClick={onCloseAll}>Закрыть</button>
        </div>
      </Fold>

      <div className="row actions">
        <button type="button" className="ghost" onClick={save}>Сохранить</button>
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Открыть файл</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onLoad(file)
            event.target.value = ''
          }}
        />
      </div>
      {note && <p className="note">{note}</p>}

      <Fold title="Для цеха">
        <ul className="spec">
          {spec.map((row) => (
            <li key={row.name}><strong>{row.name}</strong><span>{row.value}</span></li>
          ))}
        </ul>
      </Fold>

      <CutlistEntry nest={nest} onOpen={onCutlist} />
    </aside>
  )
}
