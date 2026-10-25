import { useRef } from 'react'
import type { Part, SpecRow } from '../geometry'
import { FacadeSection } from '../facade/section'
import type { NestResult } from '../cutlist/nest'
import { CutlistEntry } from '../cutlist/page'
import { boards } from '../model'
import {
  Choice,
  Fold,
  Measure,
  Swatches,
} from '../ui'
import { shoeCatalogPresets } from '../catalog/presets'
import { envelopeOf, fitsOpening, limitsInOpening, type Survey } from '../survey/model'
import { PlaceBar } from '../survey/step'
import {
  checkShoeRules,
  setShoeDrawers,
  shoeFaceHeightMm,
  shoeLimits,
  shoeSections,
  shoeSummary,
  tipForShoe,
  type ShoeConfig,
} from './model'

export function ShoePanel({
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
  parts,
  pickedKey,
  onPick,
}: {
  config: ShoeConfig
  spec: SpecRow[]
  nest: NestResult
  note: string
  place: {
    survey: Survey | null
    onEdit: () => void
    onOrder: () => void
    ordering: boolean
    orderNote: string
  }
  onChange: (config: ShoeConfig) => void
  onOpenAll: () => void
  onCloseAll: () => void
  onLoad: (file: File) => void
  onCutlist: () => void
  parts: Part[]
  pickedKey: string | null
  onPick: (key: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const rules = checkShoeRules(config)
  const tip = (field: string) => tipForShoe(rules, field)
  const opening = place.survey ? envelopeOf(place.survey) : null
  const lim = limitsInOpening(shoeLimits, opening)
  const summary = shoeSummary(config)
  const faceMm = shoeFaceHeightMm(config)
  const sizeSummary = `${config.width} × ${config.height} × ${config.depth} · ${config.drawers} ящ. · ${faceMm} мм`

  function save() {
    const blob = new Blob([JSON.stringify({ kind: 'shoe', ...config, survey: place.survey }, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'shoe.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <aside className="panel">
      <div className="brand">
        <div>
          <h1>Обувница</h1>
          <p>ОБ-5 · откидные ящики</p>
        </div>
      </div>

      <PlaceBar
        survey={place.survey}
        onEdit={place.onEdit}
        onOrder={place.onOrder}
        ordering={place.ordering}
        orderNote={place.orderNote}
      />

      <p className="readout">
        {config.width} × {config.height} × {config.depth} мм · {config.drawers} ящ. по {faceMm} мм · {summary.color}
      </p>

      <Fold title="Размеры" summary={sizeSummary}>
        <div className="preset-grid">
          {shoeCatalogPresets.map((item) => {
            const ok = fitsOpening(item.patch, opening)
            return (
              <button
                key={item.name}
                type="button"
                disabled={!ok}
                title={ok ? undefined : 'Не входит в проём'}
                onClick={() => {
                  if (!ok) return
                  onChange(setShoeDrawers({ ...config, ...item.patch }, item.patch.drawers ?? config.drawers))
                }}
              >
                {item.name}
                <em>{item.hint}</em>
              </button>
            )
          })}
        </div>
        {rules.length > 0 && (
          <ul className="rules">
            {rules.map((item) => (
              <li key={`${item.field}-${item.text}`} className={item.level}>{item.text}</li>
            ))}
          </ul>
        )}
        <Measure label="Ширина" value={config.width} {...lim.width} tip={tip('width')} onChange={(width) => onChange({ ...config, width })} />
        <Measure label="Высота" value={config.height} {...lim.height} tip={tip('height')} onChange={(height) => onChange({ ...config, height })} />
        <Measure label="Глубина" value={config.depth} {...lim.depth} tip={tip('depth')} onChange={(depth) => onChange({ ...config, depth })} />
        <Measure
          label="Ящики"
          unit="шт"
          value={config.drawers}
          {...shoeLimits.drawers}
          tip={tip('drawers')}
          onChange={(drawers) => onChange(setShoeDrawers(config, drawers))}
        />
        <Measure
          label="Ярусы в ящике"
          unit="шт"
          value={config.rows}
          {...shoeLimits.rows}
          tip={tip('rows')}
          onChange={(rows) => onChange({ ...config, rows })}
        />
        <p className="door-place-hint">
          Щиты параллельно фасаду · обувь стоя · носок вверх · {shoeSections} секции × {config.rows} яруса
        </p>
      </Fold>

      <Fold title="Цвет" summary={`фасад ${summary.color}`}>
        <Swatches label="Фасад" value={config.facadeColor} onChange={(facadeColor) => onChange({ ...config, facadeColor })} />
        <Swatches label="Корпус" value={config.carcassColor} onChange={(carcassColor) => onChange({ ...config, carcassColor })} />
      </Fold>

      <FacadeSection
        title="Фасад"
        parts={parts}
        pickedKey={pickedKey}
        onPick={onPick}
        look={{
          frame: config.frame,
          handle: config.handle,
          handlePos: config.handlePos,
          handleSide: config.handleSide,
          finish: config.finish,
          patterns: config.patterns,
        }}
        onLook={(look) => onChange({ ...config, ...look })}
        handleLayout="place"
      />

      <Fold title="Ещё">
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
