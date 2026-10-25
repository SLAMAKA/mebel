/**
 * Комната для сцены.
 * Без замера размер берётся от изделия.
 * С замером комната равна проёму. См. roomSizeForOpening.
 */

export type RoomPlan = {
  /** Высота потолка, м. */
  ceilingH: number
  /** Запас вокруг изделия по ширине, м. */
  padW: number
  /** Запас по глубине, м. */
  padD: number
  /** Подпись размерной линии. */
  label: string
  /** Размещение изделий относительно центра комнаты. */
  placements: RoomPlacement[]
}

export type RoomPlacement = {
  id: string
  /** Смещение изделия от центра комнаты, м. */
  x: number
  z: number
  /** Поворот вокруг Y, рад. */
  yaw: number
}

export const defaultRoomPlan: RoomPlan = {
  ceilingH: 2.7,
  padW: 1.2,
  padD: 1.6,
  label: 'потолок 270 см',
  placements: [{ id: 'main', x: 0, z: 0, yaw: 0 }],
}

export function roomSizeForProduct(
  product: { w: number; d: number },
  plan: RoomPlan = defaultRoomPlan,
) {
  return {
    w: Math.max(product.w + plan.padW * 2, 3.6),
    d: Math.max(product.d + plan.padD * 1.6, 3.2),
    h: plan.ceilingH,
  }
}

/** Ниша в метрах. Изделие ставится внутрь и не задаёт стены. */
export function roomSizeForOpening(opening: { openingW: number; openingH: number; openingD: number }) {
  return {
    w: opening.openingW / 1000,
    h: opening.openingH / 1000,
    d: opening.openingD / 1000,
  }
}

/** Главное размещение — для одного изделия на сцене. */
export function mainPlacement(plan: RoomPlan = defaultRoomPlan): RoomPlacement {
  return plan.placements[0] ?? { id: 'main', x: 0, z: 0, yaw: 0 }
}
