import { useRef } from 'react'
import type { CutRow, MarkRow, SpecRow, TapeRow } from '../geometry'
import { boards, finishes, frameModes, handles } from '../model'
import {
  Choice,
  Fold,
  FrameIcon,
  HandleIcon,
  HandlePlace,
  IconPick,
  Measure,
  Swatches,
  saveCuts,
} from '../ui'
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
  cuts,
  tapes,
  marks,
  note,
  onChange,
  onOpenAll,
  onCloseAll,
  onLoad,
}: {
  config: ShoeConfig
  spec: SpecRow[]
  cuts: CutRow[]
  tapes: TapeRow[]
  marks: MarkRow[]
  note: string
  onChange: (config: ShoeConfig) => void
  onOpenAll: () => void
  onCloseAll: () => void
  onLoad: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const rules = checkShoeRules(config)
  const tip = (field: string) => tipForShoe(rules, field)
  const summary = shoeSummary(config)
  const faceMm = shoeFaceHeightMm(config)
  const sizeSummary = `${config.width} × ${config.height} × ${config.depth} · ${config.drawers} ящ. · ${faceMm} мм`

  function save() {
    const blob = new Blob([JSON.stringify({ kind: 'shoe', ...config }, null, 2)], { type: 'application/json' })
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

      <p className="readout">
        {config.width} × {config.height} × {config.depth} мм · {config.drawers} ящ. по {faceMm} мм · {summary.color}
      </p>

      <Fold title="Размеры" summary={sizeSummary}>
        {rules.length > 0 && (
          <ul className="rules">
            {rules.map((item) => (
              <li key={`${item.field}-${item.text}`} className={item.level}>{item.text}</li>
            ))}
          </ul>
        )}
        <Measure label="Ширина" value={config.width} {...shoeLimits.width} tip={tip('width')} onChange={(width) => onChange({ ...config, width })} />
        <Measure label="Высота" value={config.height} {...shoeLimits.height} tip={tip('height')} onChange={(height) => onChange({ ...config, height })} />
        <Measure label="Глубина" value={config.depth} {...shoeLimits.depth} tip={tip('depth')} onChange={(depth) => onChange({ ...config, depth })} />
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

      <Fold title="Фасад" summary={`${summary.frame} · ${summary.handle}`}>
        <IconPick
          label="Рамка"
          value={config.frame}
          options={frameModes}
          render={(id) => <FrameIcon id={id} />}
          onChange={(frame) => onChange({ ...config, frame })}
        />
        <IconPick
          label="Ручка"
          value={config.handle}
          options={handles}
          render={(id) => <HandleIcon id={id} side={config.handleSide} />}
          onChange={(handle) => onChange({ ...config, handle })}
        />
        {config.handle !== 'none' && (
          <>
            <HandlePlace
              pos={config.handlePos}
              side={config.handleSide}
              onChange={(next) => onChange({ ...config, ...next })}
            />
            <Choice label="Покрытие" value={config.finish} options={finishes} onChange={(finish) => onChange({ ...config, finish })} />
          </>
        )}
      </Fold>

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
        <button type="button" className="ghost" onClick={() => saveCuts(cuts, tapes, marks)}>Скачать раскрой</button>
      </Fold>
    </aside>
  )
}
