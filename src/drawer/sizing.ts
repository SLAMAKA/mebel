/** Тип направляющих выдвижного ящика. */
export type RunnerId = 'ball' | 'roller' | 'hidden'

export const runners: {
  id: RunnerId
  name: string
  /** Зазор на сторону под механизм, м. */
  sideClear: number
  /** Зазор сверху проёма, м. */
  topClear: number
  /** Зазор снизу проёма, м. */
  bottomClear: number
  /** Зазор сзади до стенки корпуса, м. */
  backGap: number
  /** Доля выдвижения от длины направляющей. */
  pullRatio: number
}[] = [
  {
    id: 'ball',
    name: 'Шариковые',
    sideClear: 0.0125,
    topClear: 0.01,
    bottomClear: 0.01,
    backGap: 0.01,
    pullRatio: 1,
  },
  {
    id: 'roller',
    name: 'Роликовые',
    sideClear: 0.0125,
    topClear: 0.012,
    bottomClear: 0.012,
    backGap: 0.012,
    pullRatio: 0.75,
  },
  {
    id: 'hidden',
    name: 'Скрытые',
    sideClear: 0.004,
    topClear: 0.008,
    bottomClear: 0.014,
    backGap: 0.01,
    pullRatio: 1,
  },
]

/** Стандартные длины направляющих, мм. */
export const runnerLengthsMm = [250, 300, 350, 400, 450, 500, 550] as const

export function findRunner(id: RunnerId) {
  return runners.find((item) => item.id === id) ?? runners[0]
}

/** Ближайшая стандартная длина ≤ доступной глубине. */
export function runnerLengthMm(innerDepthMm: number, backGapMm: number) {
  const max = Math.max(200, Math.floor(innerDepthMm - backGapMm))
  let pick: number = runnerLengthsMm[0]
  for (const len of runnerLengthsMm) {
    if (len <= max) pick = len
  }
  return pick
}

export type DrawerOpening = {
  /** Ширина проёма внутри, м. */
  openingW: number
  /** Высота слота ящика, м. */
  openingH: number
  /** Глубина корпуса внутри, м. */
  openingD: number
}

export type DrawerBox = {
  boxW: number
  boxH: number
  boxD: number
  runnerLen: number
  travel: number
  sideClear: number
  topClear: number
  bottomClear: number
  backGap: number
  runner: (typeof runners)[number]
}

/** Короб и ход по проёму и типу направляющих. */
export function drawerBoxFromOpening(opening: DrawerOpening, runnerId: RunnerId): DrawerBox {
  const runner = findRunner(runnerId)
  const runnerLen = runnerLengthMm(opening.openingD * 1000, runner.backGap * 1000) / 1000
  const boxW = Math.max(0.08, opening.openingW - runner.sideClear * 2)
  const boxH = Math.max(0.06, opening.openingH - runner.topClear - runner.bottomClear)
  const boxD = Math.max(0.12, Math.min(runnerLen, opening.openingD - runner.backGap))
  const travel = Math.max(0.12, runnerLen * runner.pullRatio)
  return {
    boxW,
    boxH,
    boxD,
    runnerLen,
    travel,
    sideClear: runner.sideClear,
    topClear: runner.topClear,
    bottomClear: runner.bottomClear,
    backGap: runner.backGap,
    runner,
  }
}
