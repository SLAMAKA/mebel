import { useMemo, useState } from 'react'
import { compile } from './geometry'
import { defaultConfig, readConfig, sanitize, type Config } from './model'
import { Panel } from './panel'
import { Stage } from './scene'

export default function App() {
  const [config, setConfig] = useState<Config>(defaultConfig)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const compiled = useMemo(() => compile(config), [config])

  function apply(next: Config) {
    setConfig(sanitize(next))
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
      const next = readConfig(JSON.parse(text))
      if (!next) {
        setNote('Файл не похож на эскиз шкафа')
        return
      }
      setOpen({})
      setConfig(next)
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  return (
    <div className="app">
      <Panel
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
          config={config}
          compiled={compiled}
          open={open}
          shot={shot}
          onToggle={(key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
        />
        <div className="hud">
          <p>Тяни чтобы повернуть · клик открывает дверцу</p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}
