import { useRef } from 'react'
import type { CutRow, MarkRow, SpecRow, TapeRow } from './geometry'
import {
  boards,
  checkRules,
  colors,
  doorModes,
  finishes,
  findById,
  frameModes,
  handles,
  limitsFor,
  mirrorModes,
  presetsFor,
  tipFor,
  type Config,
} from './model'
import {
  BaseChoice,
  Choice,
  Fold,
  FrameIcon,
  HandleIcon,
  HandlePlace,
  IconPick,
  Measure,
  MirrorIcon,
  Swatches,
  saveCuts,
} from './ui'

export function Panel({
  config,
  title,
  subtitle,
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
  config: Config
  title: string
  subtitle: string
  spec: SpecRow[]
  cuts: CutRow[]
  tapes: TapeRow[]
  marks: MarkRow[]
  note: string
  onChange: (config: Config) => void
  onOpenAll: () => void
  onCloseAll: () => void
  onLoad: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const rules = checkRules(config)
  const tip = (field: string) => tipFor(rules, field)
  const lim = limitsFor(config.kind)
  const presets = presetsFor(config.kind)
  const isPedestal = config.kind === 'pedestal'
  const doorSummary = isPedestal
    ? `${config.drawers} ящ. · ${findById(frameModes, config.frame).name} · ${findById(handles, config.handle).name}`
    : config.doors === 'open'
      ? 'без дверей'
      : [
          findById(doorModes, config.doors).name,
          findById(frameModes, config.frame).name,
          config.mirror !== 'none' ? findById(mirrorModes, config.mirror).name : null,
          findById(handles, config.handle).name,
        ].filter(Boolean).join(' · ')
  const sizeSummary = isPedestal
    ? `${config.width} × ${config.height} × ${config.depth} · ${config.drawers} ящ.`
    : `${config.width} × ${config.height} × ${config.depth} · ${config.sections} сек.`

  function save() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${config.kind}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <aside className="panel">
      <div className="brand">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <p className="readout">
        {config.width} × {config.height} × {config.depth} мм ·{' '}
        {isPedestal ? `${config.drawers} ящ.` : `${config.sections} сек.`} ·{' '}
        {findById(colors, config.facadeColor).name}
      </p>

      <Fold title="Размеры" summary={sizeSummary}>
        <div className="chips">
          {presets.map((item) => (
            <button
              key={item.name}
              type="button"
              className="chip"
              onClick={() => onChange({ ...config, ...item.patch })}
            >
              {item.name}
            </button>
          ))}
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
          label={isPedestal ? 'Колонки' : 'Секции'}
          unit="шт"
          value={config.sections}
          {...lim.sections}
          tip={tip('sections')}
          onChange={(sections) => onChange({ ...config, sections })}
        />
        {isPedestal ? (
          <Measure
            label="Ящики в колонке"
            unit="шт"
            value={config.drawers}
            {...lim.drawers}
            tip={tip('drawers')}
            onChange={(drawers) => onChange({ ...config, drawers })}
          />
        ) : (
          <Measure
            label="Полки в секции"
            unit="шт"
            value={config.shelves}
            {...lim.shelves}
            onChange={(shelves) => onChange({ ...config, shelves })}
          />
        )}
      </Fold>

      <Fold
        title="Цвет"
        summary={`фасад ${findById(colors, config.facadeColor).name} · корпус ${findById(colors, config.carcassColor).name}`}
      >
        <Swatches label="Фасад" value={config.facadeColor} onChange={(facadeColor) => onChange({ ...config, facadeColor })} />
        <Swatches label="Корпус" value={config.carcassColor} onChange={(carcassColor) => onChange({ ...config, carcassColor })} />
      </Fold>

      <Fold title={isPedestal ? 'Фасад' : 'Дверь'} summary={doorSummary}>
        {!isPedestal && (
          <Choice label="Тип" value={config.doors} options={doorModes} tip={tip('doors')} onChange={(doors) => onChange({ ...config, doors })} />
        )}
        {(isPedestal || config.doors !== 'open') && (
          <>
            <IconPick
              label="Рамка"
              value={config.frame}
              options={frameModes}
              render={(id) => <FrameIcon id={id} />}
              onChange={(frame) => onChange({ ...config, frame })}
            />
            {!isPedestal && (
              <IconPick
                label="Зеркало"
                value={config.mirror}
                options={mirrorModes}
                tip={tip('mirror')}
                render={(id) => <MirrorIcon id={id} />}
                onChange={(mirror) => onChange({ ...config, mirror })}
              />
            )}
            <IconPick
              label="Ручка"
              value={config.handle}
              options={handles}
              render={(id) => <HandleIcon id={id} side={config.handleSide} />}
              onChange={(handle) => onChange({ ...config, handle })}
            />
            {config.handle !== 'none' && (
              <>
                {!isPedestal && (
                  <HandlePlace
                    pos={config.handlePos}
                    side={config.handleSide}
                    onChange={(next) => onChange({ ...config, ...next })}
                  />
                )}
                {isPedestal && (
                  <Choice
                    label="Высота ручки"
                    value={config.handlePos}
                    options={[
                      { id: 'top', name: 'Верх' },
                      { id: 'middle', name: 'Середина' },
                      { id: 'bottom', name: 'Низ' },
                    ]}
                    onChange={(handlePos) => onChange({ ...config, handlePos })}
                  />
                )}
                <Choice label="Покрытие ручки" value={config.finish} options={finishes} onChange={(finish) => onChange({ ...config, finish })} />
              </>
            )}
          </>
        )}
      </Fold>

      <Fold title="Ещё">
        <BaseChoice value={config.base} onChange={(base) => onChange({ ...config, base })} />
        <Choice label="Плита корпуса" value={config.carcassBoard} options={boards} onChange={(carcassBoard) => onChange({ ...config, carcassBoard })} />
        <Choice label="Плита фасада" value={config.facadeBoard} options={boards} onChange={(facadeBoard) => onChange({ ...config, facadeBoard })} />
        <div className="row">
          <button type="button" className="ghost" onClick={onOpenAll}>
            {isPedestal ? 'Выдвинуть' : 'Открыть двери'}
          </button>
          <button type="button" className="ghost" onClick={onCloseAll}>
            {isPedestal ? 'Задвинуть' : 'Закрыть двери'}
          </button>
        </div>
      </Fold>

      <div className="row actions">
        <button type="button" className="ghost" onClick={save}>Сохранить</button>
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Открыть</button>
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
