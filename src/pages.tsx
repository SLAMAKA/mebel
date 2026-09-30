import { useMemo, useState } from 'react'
import { compile } from './geometry'
import { defaultsByKind, readConfig, sanitize, type Config } from './model'
import { Panel } from './panel'
import { Stage } from './scene'

const meta = {
  wardrobe: {
    title: 'Шкаф',
    subtitle: 'Конструктор корпуса',
    hint: 'Тяни чтобы повернуть · клик открывает дверцу',
  },
  pedestal: {
    title: 'Тумба',
    subtitle: 'Тумба с ящиками',
    hint: 'Тяни чтобы повернуть · клик выдвигает ящик',
  },
} as const

function ProductPage({ kind }: { kind: 'wardrobe' | 'pedestal' }) {
  const [config, setConfig] = useState<Config>(defaultsByKind[kind])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const compiled = useMemo(() => compile(config), [config])
  const copy = meta[kind]

  function apply(next: Config) {
    setConfig(sanitize({ ...next, kind }))
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
        setNote('Файл не похож на эскиз')
        return
      }
      if (kind === 'pedestal' && next.kind !== 'pedestal') {
        setNote('Это не эскиз тумбы')
        return
      }
      if (kind === 'wardrobe' && next.kind === 'pedestal') {
        setNote('Это эскиз тумбы. Откройте страницу Тумба.')
        return
      }
      setOpen({})
      setConfig(sanitize({ ...next, kind }))
      setShot((value) => value + 1)
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  return (
    <div className="app">
      <Panel
        config={config}
        title={copy.title}
        subtitle={copy.subtitle}
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
          <p>{copy.hint}</p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}

export function WardrobePage() {
  return <ProductPage kind="wardrobe" />
}

export function PedestalPage() {
  return <ProductPage kind="pedestal" />
}
