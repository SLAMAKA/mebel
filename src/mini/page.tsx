import { useMemo, useState } from 'react'
import { useOrder } from '../order/client'
import { Stage } from '../scene'
import { envelopeOf, fitBox, openingBlock, readSurvey } from '../survey/model'
import { SurveyStep, useOpening } from '../survey/step'
import { compileMini } from './geometry'
import { MiniPanel } from './panel'
import {
  defaultMiniConfig,
  miniAsSceneLook,
  miniLimits,
  readMiniConfig,
  sanitizeMini,
  type MiniConfig,
} from './model'

export function MiniPage() {
  const [config, setConfig] = useState<MiniConfig>(defaultMiniConfig)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [shot, setShot] = useState(0)
  const [note, setNote] = useState('')
  const place = useOpening()
  const order = useOrder()
  const compiled = useMemo(() => compileMini(config, place.survey), [config, place.survey])
  const look = miniAsSceneLook(config)

  function apply(next: MiniConfig) {
    setConfig(sanitizeMini(next, place.opening))
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
      const next = readMiniConfig(parsed)
      if (!next) {
        setNote('Файл не похож на мини-шкафчик')
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
      const block = openingBlock(opening, miniLimits)
      if (block) {
        setNote(block)
        return
      }
      place.accept(saved)
      setConfig(sanitizeMini({ ...next, ...fitBox(next, miniLimits, opening) }, opening))
      setNote('')
    }).catch(() => setNote('Не удалось прочитать файл'))
  }

  if (place.phase === 'survey') {
    return (
      <SurveyStep
        mode="free"
        title="Мини"
        fields={place.fields}
        limits={miniLimits}
        onChange={place.setFields}
        onSkip={() => {
          place.skip()
          setShot((value) => value + 1)
        }}
        onDone={(survey) => {
          const opening = place.accept(survey)
          setConfig((prev) => sanitizeMini({ ...prev, ...fitBox(prev, miniLimits, opening) }, opening))
          setOpen({})
          setShot((value) => value + 1)
        }}
      />
    )
  }

  return (
    <div className="app">
      <MiniPanel
        config={config}
        spec={compiled.spec}
        cuts={compiled.cuts}
        tapes={compiled.tapes}
        marks={compiled.marks}
        nest={compiled.nest}
        note={note}
        place={{
          survey: place.survey,
          onEdit: place.edit,
          onOrder: () => order.order({ kind: 'mini', survey: place.survey, config }),
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
          config={look}
          compiled={compiled}
          open={open}
          shot={shot}
          opening={place.opening}
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
