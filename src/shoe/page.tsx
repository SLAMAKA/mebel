import { useEffect, useMemo, useState } from 'react'
import { useOrder } from '../order/client'
import { CutlistPage } from '../cutlist/page'
import { Stage } from '../scene'
import { envelopeOf, fitBox, openingBlock, readSurvey } from '../survey/model'
import { SurveyStep, useOpening } from '../survey/step'
import { compileShoe } from './geometry'
import { ShoePanel } from './panel'
import {
  defaultShoeConfig,
  readShoeConfig,
  sanitizeShoe,
  shoeAsSceneLook,
  shoeFaceHeightMm,
  shoeLimits,
  type ShoeConfig,
} from './model'

export function ShoePage() {
  const [config, setConfig] = useState<ShoeConfig>(defaultShoeConfig)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const [cutOpen, setCutOpen] = useState(false)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const place = useOpening()
  const order = useOrder()
  const compiled = useMemo(() => compileShoe(config, place.survey), [config, place.survey])
  const look = shoeAsSceneLook(config)
  const facades = compiled.parts.filter((part) => part.role === 'facade' && !part.ghost)
  const pick = pickedKey && facades.some((part) => part.key === pickedKey) ? pickedKey : (facades[0]?.key ?? null)

  useEffect(() => {
    setOpen({})
    setShot((value) => value + 1)
  }, [config.width, config.height, config.depth, config.drawers])

  function apply(next: ShoeConfig) {
    setConfig(sanitizeShoe(next, place.opening))
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
      const next = readShoeConfig(parsed)
      if (!next) {
        setNote('Файл не похож на обувницу')
        return
      }
      const saved = readSurvey(parsed.survey)
      setOpen({})
      setShot((value) => value + 1)
      if (!saved) {
        place.skip()
        setConfig(next)
        setNote('')
        return
      }
      const opening = envelopeOf(saved)
      const block = openingBlock(opening, shoeLimits)
      if (block) {
        setNote(block)
        return
      }
      place.accept(saved)
      setConfig(sanitizeShoe({ ...next, ...fitBox(next, shoeLimits, opening) }, opening))
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  if (place.phase === 'survey') {
    return (
      <SurveyStep
        mode="free"
        title="Обувница"
        fields={place.fields}
        limits={shoeLimits}
        onChange={place.setFields}
        onSkip={() => {
          place.skip()
          setShot((value) => value + 1)
        }}
        onDone={(survey) => {
          const opening = place.accept(survey)
          setConfig((prev) => sanitizeShoe({ ...prev, ...fitBox(prev, shoeLimits, opening) }, opening))
          setOpen({})
          setShot((value) => value + 1)
        }}
      />
    )
  }

  if (cutOpen) {
    return (
      <CutlistPage
        title="Обувница"
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
    <div className="app">
      <ShoePanel
        config={config}
        spec={compiled.spec}
        nest={compiled.nest}
        note={note}
        place={{
          survey: place.survey,
          onEdit: place.edit,
          onOrder: () => order.order({ kind: 'shoe', survey: place.survey, config }),
          ordering: order.ordering,
          orderNote: order.orderNote,
        }}
        onChange={apply}
        onOpenAll={() => setFronts(true)}
        onCloseAll={() => setFronts(false)}
        onLoad={load}
        onCutlist={() => setCutOpen(true)}
        parts={compiled.parts}
        pickedKey={pick}
        onPick={setPickedKey}
      />
      <main className="view">
        <Stage
          config={look}
          compiled={compiled}
          open={open}
          shot={shot}
          opening={place.opening}
          pickedKey={pick}
          onPickPart={setPickedKey}
        />
        <div className="hud">
          <p>
            Обувница · {config.drawers} ящ. по {shoeFaceHeightMm(config)} мм · клик по фасаду открывает ручку рамку и узор
          </p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}
