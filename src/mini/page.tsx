import { useMemo, useState } from 'react'
import { Stage } from '../scene'
import { compileMini } from './geometry'
import { MiniPanel } from './panel'
import {
  defaultMiniConfig,
  miniAsSceneLook,
  readMiniConfig,
  sanitizeMini,
  type MiniConfig,
} from './model'

export function MiniPage() {
  const [config, setConfig] = useState<MiniConfig>(defaultMiniConfig)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const compiled = useMemo(() => compileMini(config), [config])
  const look = miniAsSceneLook(config)

  function apply(next: MiniConfig) {
    setConfig(sanitizeMini(next))
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
      const next = readMiniConfig(JSON.parse(text))
      if (!next) {
        setNote('Файл не похож на мини-шкафчик')
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
      <MiniPanel
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
            {config.mount === 'wall'
              ? 'Навесной · тяни чтобы повернуть · клик открывает'
              : 'Напольный · тяни чтобы повернуть · клик открывает'}
          </p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}
