import { useState, type KeyboardEvent } from 'react'
import type { CutRow, MarkRow, TapeRow } from '../geometry'
import { saveMillDxf } from '../pattern/dxf'
import { cncJobs, type MillJob } from '../pattern/jobs'
import { saveCutterCsv, saveNestSvg, saveShopCsv } from './export'
import { NestMap } from './NestMap'
import { cutsForTab, nestTabs, type NestResult } from './nest'

export function CutlistEntry({
  nest,
  onOpen,
}: {
  nest: NestResult
  onOpen: () => void
}) {
  return (
    <section className="fold">
      <button type="button" className="fold-head" onClick={onOpen}>
        <span className="fold-title">
          Раскрой
          <em className="fold-summary">
            {nest.sheetCount} лист. · {Math.round(nest.utilAvg * 100)}%
          </em>
        </span>
        <span className="fold-mark" aria-hidden="true">→</span>
      </button>
    </section>
  )
}

export function CutlistPage({
  title,
  nest,
  cuts,
  tapes,
  marks,
  mill,
  onBack,
}: {
  title: string
  nest: NestResult
  cuts: CutRow[]
  tapes: TapeRow[]
  marks: MarkRow[]
  mill: MillJob[]
  onBack: () => void
}) {
  const tabs = nestTabs(nest)
  const [tabKey, setTabKey] = useState(tabs[0]?.key ?? '')
  const tab = tabs.find((item) => item.key === tabKey) ?? tabs[0]
  const cam = cncJobs(mill)
  const rows = tab ? cutsForTab(cuts, tab) : []

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!tabs.length) return
    const index = Math.max(0, tabs.findIndex((item) => item.key === tab?.key))
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      setTabKey(tabs[(index + 1) % tabs.length].key)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      setTabKey(tabs[(index - 1 + tabs.length) % tabs.length].key)
    }
  }

  return (
    <div className="app cut-app">
      <header className="cut-head">
        <div className="cut-head-row">
          <button type="button" className="ghost" onClick={onBack}>К дизайну</button>
          <div>
            <h1>Раскрой</h1>
            <p>
              {title}
              {nest.sheetCount
                ? ` · ${nest.sheetCount} лист ${nest.sheetL}×${nest.sheetW} · пропил ${nest.kerf} мм`
                : ''}
            </p>
          </div>
        </div>
        <div className="cut-actions">
          <button type="button" className="chip on" onClick={() => saveShopCsv(cuts, tapes, marks)}>
            Цех CSV
          </button>
          <button type="button" className="ghost" onClick={() => saveCutterCsv(cuts)}>
            Раскройщик CSV
          </button>
          <button type="button" className="ghost" onClick={() => saveNestSvg(nest)} disabled={!nest.sheetCount}>
            Карты SVG
          </button>
          <button type="button" className="ghost" onClick={() => saveMillDxf(mill)} disabled={!cam.length}>
            ЧПУ DXF
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            Печать
          </button>
        </div>
        <p className="cut-hint">
          Цех CSV открывается в Excel. Раскройщик CSV идёт в Cutting OptiCut и CutList Optimizer. Карты SVG для печати. ЧПУ DXF — выборка и сквозной вырез на фасадах в мм. Узор «на поверхности» в файл не идёт. Фрезу и подачу ставит оператор.
        </p>
      </header>
      {!tabs.length ? (
        <p className="cut-empty">Деталей для раскроя нет. Вернись к дизайну.</p>
      ) : (
        <>
          <div className="cut-tabs" role="tablist" aria-label="Материал" onKeyDown={onTabKey}>
            {tabs.map((item, index) => {
              const on = item.key === tab?.key
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`cut-tab-${index}`}
                  aria-selected={on}
                  aria-controls="cut-panel"
                  tabIndex={on ? 0 : -1}
                  className={on ? 'chip on' : 'chip'}
                  onClick={() => setTabKey(item.key)}
                >
                  {item.label}
                  <span className="cut-tab-meta">
                    {item.sheets.length} лист · {Math.round(item.utilAvg * 100)}%
                  </span>
                </button>
              )
            })}
          </div>
          <div className="cut-scroll">
            {tab && (
              <div className="cut-body" role="tabpanel" id="cut-panel">
                <NestMap sheets={tab.sheets} sheetL={nest.sheetL} sheetW={nest.sheetW} />
                <aside className="cut-side">
                  <table className="cut-table">
                    <caption>Детали</caption>
                    <thead>
                      <tr>
                        <th>Деталь</th>
                        <th>Длина</th>
                        <th>Ширина</th>
                        <th>Шт</th>
                        <th>Кромка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.name}-${row.length}-${row.width}-${row.edge}`}>
                          <td>{row.name}</td>
                          <td>{row.length}</td>
                          <td>{row.width}</td>
                          <td>{row.qty}</td>
                          <td>{row.edge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </aside>
              </div>
            )}
            {(tapes.length > 0 || marks.length > 0) && (
              <div className="cut-foot">
                {tapes.length > 0 && (
                  <ul className="spec">
                    {tapes.map((tape) => (
                      <li key={tape.name}>
                        <strong>{tape.name}</strong>
                        <span>нужно {tape.need} м · заказать {tape.order} м</span>
                      </li>
                    ))}
                  </ul>
                )}
                {marks.length > 0 && (
                  <ul className="spec">
                    {marks.map((mark) => (
                      <li key={`${mark.title}-${mark.text}`}>
                        <strong>{mark.title}</strong>
                        <span>{mark.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
