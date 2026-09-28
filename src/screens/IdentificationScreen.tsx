import { useState } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { Select } from '../components/Select'
import { StatusMessage } from '../components/StatusMessage'
import { TextInput } from '../components/TextInput'
import { NumberInput } from '../components/NumberInput'
import { IDENTIFICATION } from '../data/identification'
import type { IdentificationField } from '../data/identification'
import { STRINGS } from '../data/strings'
import { useQuestionnaire } from '../state/useQuestionnaire'
import './IdentificationScreen.css'

export function IdentificationScreen() {
  const { state, dispatch, steps } = useQuestionnaire()
  const [showError, setShowError] = useState(false)

  const fields = state.audience ? IDENTIFICATION[state.audience] : []
  // Nothing to accept any more: the notice informs, it does not ask. What
  // still holds the respondent here is a required field — the company name.
  const canContinue = fields.every(
    (field) => !field.required || String(state.identification[field.id] ?? '').trim() !== '',
  )

  function next() {
    if (!canContinue) {
      setShowError(true)
      return
    }
    setShowError(false)
    dispatch({ type: 'GO_NEXT', stepCount: steps.length })
  }

  return (
    <Screen
      title={STRINGS.identification.title}
      subtitle={STRINGS.identification.subtitle}
      actions={
        <>
          <Button variant="secondary" onClick={() => dispatch({ type: 'GO_BACK' })}>
            {STRINGS.actions.back}
          </Button>
          <Button onClick={next} disabled={!canContinue}>
            {STRINGS.actions.next}
          </Button>
        </>
      }
    >
      {fields.map((field) => (
        <IdentificationInput key={field.id} field={field} />
      ))}

      {/* Informing is still required (art. 13 RGPD) even though nothing is
          being asked for, so the notice stays and only the tick box goes.
          Companies are named, consumers are not — the promise differs. */}
      <div className="privacy">
        <StatusMessage tone="info" live={false}>
          {state.audience === 'company'
            ? STRINGS.identification.privacyNoticeCompany
            : STRINGS.identification.privacyNoticeIndividual}
        </StatusMessage>
      </div>

      {showError && !canContinue && (
        <StatusMessage tone="error">{STRINGS.identification.fieldRequired}</StatusMessage>
      )}
    </Screen>
  )
}

function IdentificationInput({ field }: { field: IdentificationField }) {
  const { state, dispatch } = useQuestionnaire()
  const raw = state.identification[field.id]
  const value = raw === undefined ? '' : String(raw)

  function set(next: string) {
    dispatch({ type: 'SET_IDENTIFICATION_FIELD', field: field.id, value: next })
  }

  if (field.type === 'select') {
    return (
      <Select
        label={field.label}
        options={field.options ?? []}
        value={value === '' ? null : value}
        onChange={set}
      />
    )
  }

  if (field.type === 'number') {
    return <NumberInput label={field.label} value={value} onChange={set} />
  }

  return (
    <TextInput
      label={field.label}
      value={value}
      onChange={set}
      maxLength={field.maxLength}
      autoComplete={field.type === 'email' ? 'email' : 'off'}
    />
  )
}
