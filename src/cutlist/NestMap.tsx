import type { NestResult, NestSheet } from './nest'

function SheetSvg({ sheet, sheetL, sheetW }: { sheet: NestSheet; sheetL: number; sheetW: number }) {
  const viewW = 280
  const viewH = Math.round((sheetW / sheetL) * viewW)
  const sx = viewW / sheetL
  const sy = viewH / sheetW
  const colors = ['#c4a36e', '#8ea394', '#6b8cae', '#b65d42', '#7a7f86', '#5b6b7c']
  return (
    <svg className="nest-svg" viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label={`Лист ${sheet.index + 1}`}>
      <rect x={0} y={0} width={viewW} height={viewH} className="nest-sheet" />
      {sheet.placements.map((piece, i) => (
        <g key={piece.id}>
          <rect
            x={piece.x * sx}
            y={piece.y * sy}
            width={piece.w * sx}
            height={piece.h * sy}
            fill={colors[i % colors.length]}
            opacity={0.85}
            stroke="#2a241e"
            strokeWidth={0.6}
          />
          <title>{`${piece.name} ${Math.round(piece.w)}×${Math.round(piece.h)}${piece.rotated ? ' (пов.)' : ''}`}</title>
        </g>
      ))}
    </svg>
  )
}

export function NestMap({ nest }: { nest: NestResult }) {
  if (!nest.sheetCount) {
    return <p className="readout">Нет деталей для раскроя</p>
  }
  return (
    <div className="nest-map">
      <p className="readout">
        {nest.sheetCount} лист. · утилизация {Math.round(nest.utilAvg * 100)}% · {nest.sheetL}×{nest.sheetW} · пропил {nest.kerf} мм
      </p>
      {nest.sheets.map((sheet) => (
        <div key={sheet.index} className="nest-card">
          <div className="nest-card-head">
            Лист {sheet.index + 1} · {sheet.material} {sheet.thick} мм · {Math.round(sheet.util * 100)}%
          </div>
          <SheetSvg sheet={sheet} sheetL={nest.sheetL} sheetW={nest.sheetW} />
          <ul className="nest-list">
            {sheet.placements.map((piece) => (
              <li key={piece.id}>
                {piece.name} · {Math.round(piece.w)}×{Math.round(piece.h)}
                {piece.rotated ? ' · повёрт' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
