import { useMemo, useState } from 'react'
import { useFloatSide } from '../ui'
import { CutlistPage } from '../cutlist/page'
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
  const [cutOpen, setCutOpen] = useState(false)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const side = useFloatSide()
  const place = useOpening()
  const compiled = useMemo(() => compileMini(config, place.survey), [config, place.survey])
  const look = miniAsSceneLook(config)
  const facades = compiled.parts.filter((part) => part.role === 'facade' && !part.ghost)
  const pick = pickedKey && facades.some((part) => part.key === pickedKey) ? pickedKey : (facades[0]?.key ?? null)

  function apply(next: MiniConfig) {
    setConfig(sanitizeMini(next, place.opening))
    setNote('')
  }

  function pickPart(key: string) {
    setPickedKey(key)
    side.show()
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

  if (cutOpen) {
    return (
      <CutlistPage
        title="Мини"
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
      <MiniPanel
        config={config}
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
        parts={compiled.parts}
        pickedKey={pick}
        onPick={pickPart}
        onHide={side.hide}
      />
      {!side.open && (
        <button type="button" className="sidebar-open" onClick={side.show}>Мини</button>
      )}
      <main className="view">
        <Stage
          config={look}
          compiled={compiled}
          open={open}
          shot={shot}
          opening={place.opening}
          pickedKey={pick}
          onPickPart={pickPart}
        />
        <div className="hud">
          <p>
            {config.mount === 'wall'
              ? 'Навесной · тяни чтобы повернуть · клик по фасаду открывает ручку рамку и узор'
              : 'Напольный · тяни чтобы повернуть · клик по фасаду открывает ручку рамку и узор'}
          </p>
          <button type="button" onClick={() => setShot((value) => value + 1)}>В кадр</button>
        </div>
      </main>
    </div>
  )
}
