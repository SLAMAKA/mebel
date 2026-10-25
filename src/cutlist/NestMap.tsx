import { pieceFill } from './export'
import { materialLabel, type NestSheet } from './nest'

function SheetSvg({
  sheet,
  sheetL,
  sheetW,
  index,
}: {
  sheet: NestSheet
  sheetL: number
  sheetW: number
  index: number
}) {
  const viewW = 720
  const viewH = Math.round((sheetW / sheetL) * viewW)
  const sx = viewW / sheetL
  const sy = viewH / sheetW
  return (
    <svg
      className="nest-svg"
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label={`Лист ${index + 1} ${sheet.material} ${sheet.thick} мм`}
    >
      <rect x={0} y={0} width={viewW} height={viewH} className="nest-sheet" />
      {sheet.placements.map((piece) => {
        const w = piece.w * sx
        const h = piece.h * sy
        const label = `${piece.name} ${Math.round(piece.w)}×${Math.round(piece.h)}`
        const show = w > 56 && h > 18
        return (
          <g key={piece.id}>
            <rect
              x={piece.x * sx}
              y={piece.y * sy}
              width={w}
              height={h}
              fill={pieceFill(piece.name)}
              opacity={0.92}
              stroke="#241c16"
              strokeWidth={0.8}
            />
            {show ? (
              <text
                x={piece.x * sx + w / 2}
                y={piece.y * sy + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#241c16"
                fontSize={Math.min(11, w * 0.12, h * 0.45)}
              >
                {label}
              </text>
            ) : (
              <title>{label}</title>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function NestMap({
  sheets,
  sheetL,
  sheetW,
}: {
  sheets: NestSheet[]
  sheetL: number
  sheetW: number
}) {
  if (!sheets.length) {
    return <p className="cut-empty">На этом материале деталей нет</p>
  }
  return (
    <div className="nest-map">
      {sheets.map((sheet, index) => (
        <article key={sheet.index} className="nest-card">
          <div className="nest-card-head">
            Лист {index + 1} · {materialLabel(sheet.material, sheet.thick)} · {Math.round(sheet.util * 100)}%
          </div>
          <SheetSvg sheet={sheet} sheetL={sheetL} sheetW={sheetW} index={index} />
        </article>
      ))}
    </div>
  )
}
