import { useEffect, useMemo, useState } from 'react'
import { Stage } from '../scene'
import { compileShoe } from './geometry'
import { ShoePanel } from './panel'
import {
  defaultShoeConfig,
  readShoeConfig,
  sanitizeShoe,
  shoeAsSceneLook,
  shoeFaceHeightMm,
  type ShoeConfig,
} from './model'

export function ShoePage() {
  const [config, setConfig] = useState<ShoeConfig>(defaultShoeConfig)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const compiled = useMemo(() => compileShoe(config), [config])
  const look = shoeAsSceneLook(config)

  useEffect(() => {
    setOpen({})
    setShot((value) => value + 1)
  }, [config.width, config.height, config.depth, config.drawers])

  function apply(next: ShoeConfig) {
    setConfig(sanitizeShoe(next))
    setNote('')
  }

  function setFronts(flag: boolean) {
    const next: Record<string, boolean> = {}
    for (const part of compiled.parts) {
      if (part.move) next[part.key] = flag
    }
    setOpen(next)
  }

  function load(file: File) {
    file.text().then((text) => {
      const next = readShoeConfig(JSON.parse(text))
      if (!next) {
        setNote('Файл не похож на обувницу')
        return
      }
      setOpen({})
      setConfig(next)
      setShot((value) => value + 1)
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  return (
    <div className="app">
      <ShoePanel
        config={config}
        spec={compiled.spec}
        cuts={compiled.cuts}
        tapes={compiled.tapes}
        marks={compiled.marks}
        note={note}
        onChange={apply}
        onOpenAll={() => setFronts(true)}
        onCloseAll={() => setFronts(false)}
        onLoad={load}
      />
      <main className="view">
        <Stage
          config={look}
          compiled={compiled}
          open={open}
          shot={shot}
          onToggle={(key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
        />
        <div className="hud">
          <p>
            Обувница · {config.drawers} ящ. по {shoeFaceHeightMm(config)} мм · клик откидывает
          </p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}
