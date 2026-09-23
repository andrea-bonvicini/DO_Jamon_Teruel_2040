import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../components/Button'
import { Logo } from '../components/Logo'
import { CheckboxGroup } from '../components/CheckboxGroup'
import { NumberInput } from '../components/NumberInput'
import { ProgressBar } from '../components/ProgressBar'
import { RadioGroup } from '../components/RadioGroup'
import { ScaleGrid } from '../components/ScaleGrid'
import { ScaleInput } from '../components/ScaleInput'
import { Screen } from '../components/Screen'
import { Select } from '../components/Select'
import { StatusMessage } from '../components/StatusMessage'
import { TextArea } from '../components/TextArea'
import { TextInput } from '../components/TextInput'
import { QUESTIONNAIRES } from '../data/questionnaires'
import './StyleGuide.css'

/**
 * Internal component gallery — a development aid, not part of the respondent
 * flow. Reached at /styleguide in dev; it is never linked from the app.
 *
 * The sample content is taken from the real questionnaires so the gallery
 * shows the components at the sizes they actually have to work at (a 19-item
 * select, a 13-row grid, an 11-point scale).
 */
export function StyleGuide() {
  const individual = QUESTIONNAIRES.individual
  const regionQuestion = individual.questions.find((q) => q.id === 'I-Q03')
  const gridQuestion = individual.questions.find((q) => q.id === 'I-Q09')
  const frequency = individual.questions.find((q) => q.id === 'I-Q06')
  const channels = individual.questions.find((q) => q.id === 'I-Q08')

  const [radio, setRadio] = useState<string | null>(null)
  const [checks, setChecks] = useState<string[]>([])
  const [scale, setScale] = useState<number | null>(null)
  const [nps, setNps] = useState<number | null>(null)
  const [grid, setGrid] = useState<Record<string, number>>({})
  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const [num, setNum] = useState('')
  const [region, setRegion] = useState<string | null>(null)

  return (
    <Screen title="Guía de estilo" subtitle="Galería interna de componentes." width="wide">
      <div className="sg">
        <Section title="Paleta">
          <p className="sg__note">
            El granate es el color principal: ocupa el panel de cada pantalla. La crema es el
            secundario y sostiene el área de respuesta. El oro solo aparece sobre granate —
            sobre crema da 2,46:1 y nunca lleva texto.
          </p>
          <div className="sg__swatches">
            {[
              ['granate oscuro', '#641933'],
              ['granate', '#7b2140'],
              ['vino', '#a33553'],
              ['oro', '#c39a4b'],
              ['wine-100', '#f0dce2'],
              ['crema', '#fcf8f0'],
              ['beige', '#f5eddd'],
              ['línea', '#e7dfd2'],
              ['texto', '#3a2a2e'],
            ].map(([name, hex]) => (
              <div className="sg__swatch" key={name}>
                <span className="sg__chip" style={{ background: hex }} />
                <code>{name}</code>
                <code className="sg__hex">{hex}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografía">
          <h1>Título de pantalla</h1>
          <h2>Encabezado de sección</h2>
          <p>
            Texto de párrafo en Source Sans 3. El cuerpo usa una sans humanista y los títulos una
            serif, para alejarse del registro de panel de control genérico.
          </p>
        </Section>

        <Section title="Botones">
          <div className="sg__row">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="quiet">Discreto</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
        </Section>

        <Section title="Progreso">
          <ProgressBar current={7} total={20} label="Pregunta 7 de 20" />
        </Section>

        <Section title="Panel rojo (color principal)">
          <div className="sg__panel">
            <Logo size="md" />
            <ProgressBar current={3} total={17} label="Pregunta 3 de 17" />
            <h2 className="sg__panel-title">Tipo de actividad principal</h2>
            <p className="sg__panel-help">Marque una.</p>
          </div>
        </Section>

        <Section title="Mensajes de estado">
          <StatusMessage tone="info" live={false}>
            Mensaje informativo.
          </StatusMessage>
          <StatusMessage tone="success" live={false}>
            Sus respuestas han quedado registradas.
          </StatusMessage>
          <StatusMessage tone="error" live={false}>
            No hemos podido guardar sus respuestas.
          </StatusMessage>
        </Section>

        {frequency?.type === 'single_choice' && (
          <Section title="RadioGroup">
            <RadioGroup
              legend={frequency.text}
              options={frequency.options}
              value={radio}
              onChange={setRadio}
            />
          </Section>
        )}

        {channels?.type === 'multi_choice' && (
          <Section title="CheckboxGroup (máx. 3)">
            <CheckboxGroup
              legend={channels.text}
              options={channels.options}
              value={checks}
              maxSelections={3}
              onChange={setChecks}
            />
          </Section>
        )}

        <Section title="ScaleInput 1–5">
          <ScaleInput
            legend="Importancia"
            min={1}
            max={5}
            minLabel="Nada importante"
            maxLabel="Muy importante"
            value={scale}
            onChange={setScale}
          />
        </Section>

        <Section title="ScaleInput 0–10 (NPS)">
          <ScaleInput
            legend="Recomendación"
            min={0}
            max={10}
            minLabel="Nada probable"
            maxLabel="Muy probable"
            value={nps}
            onChange={setNps}
          />
        </Section>

        {gridQuestion?.type === 'scale_grid' && (
          <Section title="ScaleGrid (13 filas)">
            <ScaleGrid
              legend={gridQuestion.text}
              rows={gridQuestion.rows}
              min={gridQuestion.min}
              max={gridQuestion.max}
              minLabel={gridQuestion.minLabel}
              maxLabel={gridQuestion.maxLabel}
              value={grid}
              onChange={(rowId, rating) => setGrid((prev) => ({ ...prev, [rowId]: rating }))}
            />
          </Section>
        )}

        {regionQuestion?.type === 'single_choice' && (
          <Section title="Select (19 opciones)">
            <Select
              label={regionQuestion.text}
              options={regionQuestion.options}
              value={region}
              onChange={setRegion}
            />
          </Section>
        )}

        <Section title="Campos de texto y número">
          <TextInput label="Texto corto" value={text} onChange={setText} maxLength={200} />
          <NumberInput label="Precio" value={num} onChange={setNum} min={0} max={500} unit="€/kg" />
          <TextArea label="Texto largo" value={area} onChange={setArea} maxLength={2000} />
        </Section>
      </div>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sg__section">
      <h2 className="sg__title">{title}</h2>
      <div className="sg__content">{children}</div>
    </section>
  )
}
