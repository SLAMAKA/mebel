import {
  boards,
  colors,
  finishes,
  findById,
  frameModes,
  handles,
  type Config,
} from '../model'
import {
  PANEL_T,
  buildCuts,
  buildMarks,
  buildTapes,
  layout,
  mm,
  shell,
  type Compiled,
  type Part,
  type SpecRow,
} from '../geometry'
import { sanitizeShoe, shoeSections, type ShoeConfig } from './model'

const LIFT = 0.05

function hiddenLegs(w: number, d: number, h: number): Part[] {
  const spots = [
    ['lb', -1, -1],
    ['rb', 1, -1],
    ['lf', -1, 1],
    ['rf', 1, 1],
  ] as const
  const side = 0.02
  return spots.map(([name, sx, sz]) => {
    const insetZ = sz > 0 ? 0.09 : 0.045
    return {
      key: `shoe-leg-${name}`,
      size: [side, h, side] as [number, number, number],
      pos: [sx * (w / 2 - 0.055), h / 2, sz * (d / 2 - insetZ)] as [number, number, number],
      role: 'metal' as const,
      shape: 'cyl' as const,
    }
  })
}

function buildShoeParts(config: ShoeConfig): Part[] {
  const T = PANEL_T
  const w = mm(config.width)
  const h = mm(config.height)
  const d = mm(config.depth)
  const bodyH = Math.max(0.4, h - LIFT)
  const parts: Part[] = [
    ...shell('shoe', 0, LIFT, 0, w, bodyH, d),
    ...hiddenLegs(w, d, LIFT),
  ]

  const drawers = config.drawers
  const gap = 0.003
  const faceH = (bodyH - gap * (drawers + 1)) / drawers
  const faceW = w - gap * 2
  const doorZ = d / 2 + T / 2 + 0.001
  const thick = 0.016

  for (let k = 0; k < drawers; k++) {
    const y = LIFT + gap + faceH / 2 + k * (faceH + gap)
    parts.push({
      key: `shoe-face-${k}`,
      size: [faceW, faceH, T],
      pos: [0, y, doorZ],
      role: 'facade',
      move: 'tilt',
      face: 'pz',
      mirror: 'none',
    })

    const trayD = Math.min(0.2, Math.max(0.12, faceH * 0.5))
    const sideH = faceH * 0.58
    const z = doorZ - T / 2 - trayD / 2
    const innerW = Math.max(0.08, faceW - 0.02)
    parts.push(
      {
        key: `shoe-shelf-${k}`,
        size: [innerW, thick, trayD],
        pos: [0, y - faceH / 2 + thick / 2, z],
        role: 'carcass',
        ghost: true,
      },
      {
        key: `shoe-side-l-${k}`,
        size: [thick, sideH, trayD],
        pos: [-(faceW / 2 - thick / 2), y - faceH / 2 + sideH / 2, z],
        role: 'carcass',
        ghost: true,
      },
      {
        key: `shoe-side-r-${k}`,
        size: [thick, sideH, trayD],
        pos: [faceW / 2 - thick / 2, y - faceH / 2 + sideH / 2, z],
        role: 'carcass',
        ghost: true,
      },
      {
        key: `shoe-div-${k}`,
        size: [thick, sideH * 0.72, trayD * 0.92],
        pos: [0, y - faceH / 2 + sideH * 0.42, z],
        role: 'carcass',
        ghost: true,
      },
    )
  }

  return parts
}

function makeShoeSpec(config: ShoeConfig, parts: Part[]): SpecRow[] {
  const carcass = findById(boards, config.carcassBoard)
  const facade = findById(boards, config.facadeBoard)
  const carcassColor = findById(colors, config.carcassColor)
  const facadeColor = findById(colors, config.facadeColor)
  const handle = findById(handles, config.handle)
  const finish = findById(finishes, config.finish)
  const faces = parts.filter((part) => part.move === 'tilt')

  return [
    { name: 'Изделие', value: 'Обувница ОБ-5' },
    { name: 'Габарит', value: `${config.width} × ${config.height} × ${config.depth} мм` },
    { name: 'Ящики', value: `${config.drawers} откидных` },
    { name: 'Секции', value: `${shoeSections} в каждом ящике` },
    { name: 'Механизм', value: 'Откидной ящик на нижней петле' },
    { name: 'Опора', value: `Скрытые опоры / ${finish.name}` },
    { name: 'Корпус', value: `${carcass.name} / ${carcassColor.name}` },
    {
      name: 'Фасад материал',
      value: `${facade.name} / ${facadeColor.name} / ${findById(frameModes, config.frame).name}`,
    },
    {
      name: 'Ручка',
      value: handle.id === 'none' ? 'Без ручки' : `${handle.name} / ${finish.name}`,
    },
    { name: 'Фасады', value: `${faces.length} шт` },
  ]
}

function asShopConfig(config: ShoeConfig): Config {
  return {
    kind: 'wardrobe',
    drawers: config.drawers,
    doors: 'swing',
    mirror: 'none',
    carcassBoard: config.carcassBoard,
    carcassColor: config.carcassColor,
    facadeBoard: config.facadeBoard,
    facadeColor: config.facadeColor,
    handle: config.handle,
    handlePos: config.handlePos,
    handleSide: config.handleSide,
    finish: config.finish,
    frame: config.frame,
    base: 'legs',
    width: config.width,
    height: config.height,
    depth: config.depth,
    sections: 1,
    shelves: 0,
  }
}

export function compileShoe(input: ShoeConfig): Compiled {
  const config = sanitizeShoe(input)
  const placed = layout(buildShoeParts(config))
  const shop = asShopConfig(config)
  return {
    parts: placed.parts,
    span: placed.span,
    dims: { w: mm(config.width), h: mm(config.height), d: mm(config.depth) },
    spec: makeShoeSpec(config, placed.parts),
    cuts: buildCuts(shop, placed.parts),
    tapes: buildTapes(shop, placed.parts),
    marks: buildMarks(shop, placed.parts),
  }
}
