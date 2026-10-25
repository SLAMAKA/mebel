import { useMemo, useState } from 'react'
import { compile } from './geometry'
import { defaultsByKind, limitsFor, readConfig, sanitize, type Config } from './model'
import { useOrder } from './order/client'
import { Panel } from './panel'
import { Stage } from './scene'
import { fitBox, openingBlock, readSurvey, envelopeOf } from './survey/model'
import { SurveyStep, useOpening } from './survey/step'

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
  const place = useOpening()
  const order = useOrder()
  const limits = limitsFor(kind)
  const compiled = useMemo(() => compile(config, place.survey), [config, place.survey])
  const copy = meta[kind]

  function apply(next: Config) {
    setConfig(sanitize({ ...next, kind }, place.opening))
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
      const parsed = JSON.parse(text) as { survey?: unknown }
      const next = readConfig(parsed)
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
      const saved = readSurvey(parsed.survey)
      setOpen({})
      setShot((value) => value + 1)
      if (!saved) {
        place.skip()
        setConfig(sanitize({ ...next, kind }))
        setNote('')
        return
      }
      const opening = envelopeOf(saved)
      const block = openingBlock(opening, limits)
      if (block) {
        setNote(block)
        return
      }
      place.accept(saved)
      setConfig(sanitize({ ...next, kind, ...fitBox(next, limits, opening) }, opening))
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  if (place.phase === 'survey') {
    return (
      <SurveyStep
        mode={kind === 'wardrobe' ? 'niche' : 'free'}
        title={copy.title}
        fields={place.fields}
        limits={limits}
        onChange={place.setFields}
        onSkip={() => {
          place.skip()
          setShot((value) => value + 1)
        }}
        onDone={(survey) => {
          const opening = place.accept(survey)
          setConfig((prev) => sanitize({ ...prev, kind, ...fitBox(prev, limits, opening) }, opening))
          setOpen({})
          setShot((value) => value + 1)
        }}
      />
    )
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
        nest={compiled.nest}
        note={note}
        place={{
          survey: place.survey,
          onEdit: place.edit,
          onOrder: () => order.order({ kind, survey: place.survey, config }),
          ordering: order.ordering,
          orderNote: order.orderNote,
        }}
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
          opening={place.opening}
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
