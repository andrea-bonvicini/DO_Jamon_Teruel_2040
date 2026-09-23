import { useId, useState } from 'react'
import { Button } from '../components/Button'
import { CheckboxGroup } from '../components/CheckboxGroup'
import { NumberInput, parseDecimal } from '../components/NumberInput'
import { RadioGroup } from '../components/RadioGroup'
import { ScaleGrid } from '../components/ScaleGrid'
import { ScaleInput } from '../components/ScaleInput'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { Select } from '../components/Select'
import { TextArea } from '../components/TextArea'
import { TextInput } from '../components/TextInput'
import { STRINGS, format } from '../data/strings'
import {
  DEFAULT_LONG_TEXT_MAX,
  DEFAULT_SHORT_TEXT_MAX,
  type AnswerValue,
  type Question,
} from '../data/types'
import { useQuestionnaire } from '../state/useQuestionnaire'

interface QuestionScreenProps {
  question: Question
  index: number
  total: number
}

export function QuestionScreen({ question, index, total }: QuestionScreenProps) {
  const { state, dispatch, steps } = useQuestionnaire()
  const helpId = useId()

  const answer = state.answers[question.id]
  const describedBy = question.help ? helpId : undefined

  function setAnswer(value: AnswerValue | null) {
    dispatch({ type: 'SET_ANSWER', questionId: question.id, value })
  }

  const complete = isComplete(question, answer)
  const canContinue = complete || !question.required

  return (
    <Screen
      title={question.text}
      subtitle={
        question.help ? (
          <span id={helpId}>{question.help}</span>
        ) : !question.required ? (
          <span id={helpId}>{STRINGS.question.optional}</span>
        ) : undefined
      }
      progress={{
        current: index,
        total,
        label: format(STRINGS.question.progress, { current: index, total }),
      }}
      actions={
        <>
          <Button variant="secondary" onClick={() => dispatch({ type: 'GO_BACK' })}>
            {STRINGS.actions.back}
          </Button>
          <Button
            disabled={!canContinue}
            onClick={() => dispatch({ type: 'GO_NEXT', stepCount: steps.length })}
          >
            {STRINGS.actions.next}
          </Button>
        </>
      }
    >
      <QuestionInput
        question={question}
        answer={answer}
        onChange={setAnswer}
        describedBy={describedBy}
      />
    </Screen>
  )
}

interface QuestionInputProps {
  question: Question
  answer: AnswerValue | undefined
  onChange: (value: AnswerValue | null) => void
  describedBy?: string
}

function QuestionInput({ question, answer, onChange, describedBy }: QuestionInputProps) {
  switch (question.type) {
    case 'single_choice': {
      const value = answer?.kind === 'option' ? answer.optionId : null
      const set = (optionId: string) => onChange({ kind: 'option', optionId })

      return question.display === 'select' ? (
        <Select
          label={question.text}
          hideLabel
          options={question.options}
          value={value}
          onChange={set}
          describedBy={describedBy}
        />
      ) : (
        <RadioGroup
          legend={question.text}
          options={question.options}
          value={value}
          onChange={set}
          describedBy={describedBy}
        />
      )
    }

    case 'multi_choice': {
      const value = answer?.kind === 'options' ? answer.optionIds : []
      return (
        <CheckboxGroup
          legend={question.text}
          options={question.options}
          value={value}
          maxSelections={question.maxSelections}
          onChange={(optionIds) =>
            onChange(optionIds.length ? { kind: 'options', optionIds } : null)
          }
          describedBy={describedBy}
        />
      )
    }

    case 'scale':
      return (
        <ScaleInput
          legend={question.text}
          min={question.min}
          max={question.max}
          minLabel={question.minLabel}
          maxLabel={question.maxLabel}
          value={answer?.kind === 'number' ? answer.value : null}
          onChange={(value) => onChange({ kind: 'number', value })}
          describedBy={describedBy}
        />
      )

    case 'scale_grid': {
      const values = answer?.kind === 'scaleRows' ? answer.values : {}
      return (
        <ScaleGrid
          legend={question.text}
          rows={question.rows}
          min={question.min}
          max={question.max}
          minLabel={question.minLabel}
          maxLabel={question.maxLabel}
          value={values}
          onChange={(rowId, rating) =>
            onChange({ kind: 'scaleRows', values: { ...values, [rowId]: rating } })
          }
          describedBy={describedBy}
        />
      )
    }

    case 'short_text':
      return (
        <TextInput
          label={question.text}
          hideLabel
          value={answer?.kind === 'text' ? answer.value : ''}
          maxLength={question.maxLength ?? DEFAULT_SHORT_TEXT_MAX}
          placeholder={question.placeholder}
          onChange={(value) => onChange(value.trim() === '' ? null : { kind: 'text', value })}
          describedBy={describedBy}
        />
      )

    case 'long_text':
      return (
        <TextArea
          label={question.text}
          hideLabel
          value={answer?.kind === 'text' ? answer.value : ''}
          maxLength={question.maxLength ?? DEFAULT_LONG_TEXT_MAX}
          placeholder={question.placeholder}
          onChange={(value) => onChange(value.trim() === '' ? null : { kind: 'text', value })}
          describedBy={describedBy}
        />
      )

    case 'number':
      return (
        <NumberQuestionInput
          key={question.id}
          question={question}
          answer={answer}
          onChange={onChange}
          describedBy={describedBy}
        />
      )
  }
}

/**
 * The number input keeps the respondent's raw keystrokes so a half-typed
 * "22," is not rewritten under the cursor. Only a parseable, in-range value
 * reaches the answer store; anything else clears it, which is what disables
 * Next.
 */
function NumberQuestionInput({
  question,
  answer,
  onChange,
  describedBy,
}: QuestionInputProps & { question: Extract<Question, { type: 'number' }> }) {
  // Keyed by question id so navigating to another number question starts
  // fresh from whatever that question already stored.
  const [raw, setRaw] = useState(() => (answer?.kind === 'number' ? String(answer.value) : ''))
  const errorId = useId()

  const parsed = parseDecimal(raw)
  const outOfRange =
    parsed !== null &&
    ((question.min !== undefined && parsed < question.min) ||
      (question.max !== undefined && parsed > question.max))
  const unparseable = raw.trim() !== '' && parsed === null

  function handle(next: string) {
    setRaw(next)
    const value = parseDecimal(next)
    if (value === null) return onChange(null)
    if (question.min !== undefined && value < question.min) return onChange(null)
    if (question.max !== undefined && value > question.max) return onChange(null)
    onChange({ kind: 'number', value })
  }

  return (
    <>
      <NumberInput
        label={question.text}
        hideLabel
        value={raw}
        min={question.min}
        max={question.max}
        unit={question.unit}
        onChange={handle}
        describedBy={[describedBy, unparseable || outOfRange ? errorId : null]
          .filter(Boolean)
          .join(' ')}
      />
      {(unparseable || outOfRange) && (
        <StatusMessage tone="error">
          <span id={errorId}>
            {unparseable
              ? STRINGS.question.notANumber
              : format(STRINGS.question.outOfRange, {
                  min: question.min ?? 0,
                  max: question.max ?? 0,
                })}
          </span>
        </StatusMessage>
      )}
    </>
  )
}

/** The per-type "can we continue?" rule. The only place it is defined. */
export function isComplete(question: Question, answer: AnswerValue | undefined): boolean {
  if (!answer) return false

  switch (question.type) {
    case 'single_choice':
      return answer.kind === 'option' && question.options.some((o) => o.id === answer.optionId)

    case 'multi_choice': {
      if (answer.kind !== 'options') return false
      const count = answer.optionIds.length
      const min = question.minSelections ?? 1
      const max = question.maxSelections ?? question.options.length
      return count >= min && count <= max
    }

    case 'scale':
      return answer.kind === 'number' && answer.value >= question.min && answer.value <= question.max

    case 'scale_grid':
      return (
        answer.kind === 'scaleRows' &&
        question.rows.every((row) => {
          const value = answer.values[row.id]
          return value !== undefined && value >= question.min && value <= question.max
        })
      )

    case 'short_text':
      return (
        answer.kind === 'text' &&
        answer.value.trim() !== '' &&
        answer.value.length <= (question.maxLength ?? DEFAULT_SHORT_TEXT_MAX)
      )

    case 'long_text':
      return (
        answer.kind === 'text' &&
        answer.value.trim() !== '' &&
        answer.value.length <= (question.maxLength ?? DEFAULT_LONG_TEXT_MAX)
      )

    case 'number':
      return (
        answer.kind === 'number' &&
        (question.min === undefined || answer.value >= question.min) &&
        (question.max === undefined || answer.value <= question.max)
      )
  }
}
