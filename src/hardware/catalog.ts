import {
  findRunner,
  runnerLengthMm,
  runners,
  type RunnerId,
} from '../drawer/sizing'

/** Общие толщины плит, мм → м. */
export const BOARD_T = {
  ldsp16: 0.016,
  ldsp18: 0.018,
  hdf8: 0.008,
} as const

export type HingeId = 'clip' | 'wide'

export const hinges: {
  id: HingeId
  name: string
  cupMm: number
  edgeMm: number
}[] = [
  { id: 'clip', name: 'Скрытая clip', cupMm: 35, edgeMm: 22 },
  { id: 'wide', name: 'Накладная', cupMm: 35, edgeMm: 5 },
]

export type HandleHardwareId = 'bar' | 'knob' | 'rail' | 'bow' | 'edge' | 'cut' | 'none'

/** Посадочные данные под разметку (мм). */
export const handleHardware: {
  id: HandleHardwareId
  name: string
  holeSpanMm?: number
}[] = [
  { id: 'bar', name: 'Скоба', holeSpanMm: 128 },
  { id: 'knob', name: 'Кнопка' },
  { id: 'rail', name: 'Рейлинг', holeSpanMm: 160 },
  { id: 'bow', name: 'Дуга', holeSpanMm: 96 },
  { id: 'edge', name: 'Профиль' },
  { id: 'cut', name: 'Вырез' },
  { id: 'none', name: 'Без ручки' },
]

export function findHinge(id: HingeId) {
  return hinges.find((item) => item.id === id) ?? hinges[0]
}

export function findHandleHardware(id: HandleHardwareId) {
  return handleHardware.find((item) => item.id === id) ?? handleHardware[0]
}

/** Текст для спеки направляющих. */
export function runnerSpecLine(runnerId: RunnerId, innerDepthMm: number) {
  const runner = findRunner(runnerId)
  const len = runnerLengthMm(innerDepthMm, runner.backGap * 1000)
  const travel = Math.round(len * runner.pullRatio)
  return `${runner.name} ${len} мм · ход ${travel} мм · зазор ${Math.round(runner.sideClear * 1000)} мм/сторона`
}

export { runners, findRunner, runnerLengthMm }
export type { RunnerId }
