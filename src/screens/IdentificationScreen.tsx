import { useId, useState } from 'react'
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
  const consentId = useId()

  const fields = state.audience ? IDENTIFICATION[state.audience] : []
  const fieldsComplete = fields.every(
    (field) => !field.required || String(state.identification[field.id] ?? '').trim() !== '',
  )
  const canContinue = state.privacyAccepted && fieldsComplete

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

      <StatusMessage tone="info" live={false}>
        {/* Companies are named, consumers are not — the promise differs. */}
        {state.audience === 'company'
          ? STRINGS.identification.privacyNoticeCompany
          : STRINGS.identification.privacyNoticeIndividual}
      </StatusMessage>

      <label className="consent" htmlFor={consentId} data-checked={state.privacyAccepted || undefined}>
        <input
          id={consentId}
          className="consent__input"
          type="checkbox"
          checked={state.privacyAccepted}
          onChange={(event) => {
            dispatch({ type: 'SET_PRIVACY_ACCEPTED', accepted: event.target.checked })
            if (event.target.checked) setShowError(false)
          }}
        />
        <span className="consent__marker" aria-hidden="true" />
        <span>{STRINGS.identification.privacyLabel}</span>
      </label>

      {showError && !state.privacyAccepted && (
        <StatusMessage tone="error">{STRINGS.identification.privacyRequired}</StatusMessage>
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
