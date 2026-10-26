import { useMemo, useState } from 'react'
import { useFloatSide } from './ui'
import { compile } from './geometry'
import { defaultsByKind, limitsFor, readConfig, sanitize, type Config } from './model'
import { CutlistPage } from './cutlist/page'
import { FacadeBar } from './facade/section'
import { Panel } from './panel'
import { Stage } from './scene'
import { fitBox, openingBlock, readSurvey, envelopeOf } from './survey/model'
import { SurveyStep, useOpening } from './survey/step'

const meta = {
  wardrobe: {
    title: 'Шкаф',
    subtitle: 'Конструктор корпуса',
    hint: 'Тяни чтобы повернуть · клик по фасаду открывает ручку рамку и узор',
  },
  pedestal: {
    title: 'Тумба',
    subtitle: 'Тумба с ящиками',
    hint: 'Тяни чтобы повернуть · клик по фасаду открывает ручку рамку и узор',
  },
} as const

function ProductPage({ kind }: { kind: 'wardrobe' | 'pedestal' }) {
  const [config, setConfig] = useState<Config>(defaultsByKind[kind])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const [cutOpen, setCutOpen] = useState(false)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const side = useFloatSide()
  const place = useOpening()
  const limits = limitsFor(kind)
  const compiled = useMemo(() => compile(config, place.survey), [config, place.survey])
  const copy = meta[kind]
  const facades = compiled.parts.filter((part) => part.role === 'facade' && !part.ghost)
  const pick = pickedKey && facades.some((part) => part.key === pickedKey) ? pickedKey : null

  function apply(next: Config) {
    setConfig(sanitize({ ...next, kind }, place.opening))
    setNote('')
  }

  function pickPart(key: string) {
    setPickedKey((prev) => (prev === key ? null : key))
    side.hide()
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

  if (cutOpen) {
    return (
      <CutlistPage
        title={copy.title}
        nest={compiled.nest}
        cuts={compiled.cuts}
        tapes={compiled.tapes}
        marks={compiled.marks}
        mill={compiled.mill}
        onBack={() => setCutOpen(false)}
      />
    )
  }

  return (
    <div className={side.open ? 'app overlay' : 'app overlay sidebar-shut'}>
      <Panel
        config={config}
        title={copy.title}
        subtitle={copy.subtitle}
        spec={compiled.spec}
        nest={compiled.nest}
        note={note}
        place={{
          survey: place.survey,
          onEdit: place.edit,
        }}
        onChange={apply}
        onOpenAll={() => setFronts(true)}
        onCloseAll={() => setFronts(false)}
        onLoad={load}
        onCutlist={() => setCutOpen(true)}
        onHide={side.hide}
      />
      {!side.open && (
        <button type="button" className="sidebar-open" onClick={side.show}>{copy.title}</button>
      )}
      <main className="view">
        <Stage
          config={config}
          compiled={compiled}
          open={open}
          shot={shot}
          opening={place.opening}
          pickedKey={pick}
          onPickPart={pickPart}
        />
        {pick && (
          <FacadeBar
            parts={compiled.parts}
            pickedKey={pick}
            look={{
              frame: config.frame,
              handle: config.handle,
              handlePos: config.handlePos,
              handleSide: config.handleSide,
              finish: config.finish,
              mirror: config.mirror,
              patterns: config.patterns,
            }}
            onLook={(look) => apply({ ...config, ...look })}
            handleLayout={kind === 'pedestal' ? 'height' : 'place'}
            showMirror={kind === 'wardrobe'}
            open={Boolean(open[pick])}
            onToggle={() => setOpen((prev) => ({ ...prev, [pick]: !prev[pick] }))}
          />
        )}
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
