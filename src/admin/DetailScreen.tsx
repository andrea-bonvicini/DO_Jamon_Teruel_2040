import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { STRINGS } from '../data/strings'
import { resolveOptionText, resolveRowText, resolveSnapshot } from '../data/snapshot'
import type { SnapshotQuestion } from '../data/snapshot'
import type { AnswerValue } from '../data/types'
import { getResponseAdmin } from '../network/adminApi'
import type { AdminResponse } from '../network/adminApi'
import { audienceLabel, formatDate } from './ListScreen'

interface DetailScreenProps {
  id: string
  onBack: () => void
}

export function DetailScreen({ id, onBack }: DetailScreenProps) {
  const [response, setResponse] = useState<AdminResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getResponseAdmin(id)
      .then((value) => {
        if (!cancelled) setResponse(value)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : STRINGS.errors.generic)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const back = (
    <Button variant="secondary" onClick={onBack}>
      {STRINGS.admin.back}
    </Button>
  )

  if (error) {
    return (
      <Screen title={STRINGS.admin.detailTitle} width="wide" actions={back}>
        <StatusMessage tone="error">{error}</StatusMessage>
      </Screen>
    )
  }

  if (!response) {
    return (
      <Screen title={STRINGS.admin.detailTitle} width="wide" actions={back}>
        <p className="admin__status">{STRINGS.admin.loading}</p>
      </Screen>
    )
  }

  const snapshot = resolveSnapshot(response.questionnaire)
  const identification = Object.entries(response.identification ?? {})

  // Group the snapshot's questions by section, in snapshot order.
  const sections: Array<{ id: string; name: string; questions: SnapshotQuestion[] }> = []
  for (const question of response.questionnaire?.questions ?? []) {
    let section = sections.find((entry) => entry.id === question.sectionId)
    if (!section) {
      section = { id: question.sectionId, name: question.sectionName, questions: [] }
      sections.push(section)
    }
    section.questions.push(question)
  }

  // An answer with no snapshot entry must still be shown, never dropped.
  const orphans = Object.keys(response.answers ?? {}).filter((key) => !snapshot.has(key))

  return (
    <Screen title={STRINGS.admin.detailTitle} width="wide" actions={back}>
      <dl className="admin__meta">
        <dt>{STRINGS.admin.colDate}</dt>
        <dd>{formatDate(response.created_at)}</dd>
        <dt>{STRINGS.admin.colType}</dt>
        <dd>{audienceLabel(response.respondent_type)}</dd>
        <dt>{STRINGS.admin.colVersion}</dt>
        <dd>{response.questionnaire_version}</dd>
        {identification.length === 0 ? (
          <>
            <dt>{STRINGS.admin.colIdentification}</dt>
            <dd>{STRINGS.admin.anonymous}</dd>
          </>
        ) : (
          identification.map(([key, value]) => (
            <div key={key} className="admin__meta-pair">
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))
        )}
      </dl>

      {sections.map((section) => (
        <section key={section.id} className="admin__section">
          <h2 className="admin__section-title">{section.name}</h2>
          <dl className="admin__answers">
            {section.questions.map((question) => (
              <div key={question.id} className="admin__answer">
                <dt>
                  <span className="admin__qid">{question.id}</span> {question.text}
                </dt>
                <dd>
                  <AnswerView question={question} answer={response.answers?.[question.id]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {orphans.length > 0 && (
        <section className="admin__section">
          <h2 className="admin__section-title">{STRINGS.admin.unresolved}</h2>
          <dl className="admin__answers">
            {orphans.map((key) => (
              <div key={key} className="admin__answer">
                <dt>{key}</dt>
                <dd>
                  <code>{JSON.stringify(response.answers[key])}</code>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {response.open_answer && (
        <section className="admin__section">
          <h2 className="admin__section-title">{STRINGS.admin.openAnswerHeading}</h2>
          <p className="admin__open">{response.open_answer}</p>
        </section>
      )}
    </Screen>
  )
}

/** Renders from the SNAPSHOT. A bare option id is never shown. */
function AnswerView({
  question,
  answer,
}: {
  question: SnapshotQuestion
  answer: AnswerValue | undefined
}) {
  if (!answer) return <span className="admin__empty">{STRINGS.admin.noAnswer}</span>

  switch (answer.kind) {
    case 'option': {
      const text = resolveOptionText(question, answer.optionId)
      return text ? <>{text}</> : <Unresolved raw={answer.optionId} />
    }

    case 'options':
      return (
        <ul className="admin__list">
          {answer.optionIds.map((optionId) => {
            const text = resolveOptionText(question, optionId)
            return (
              <li key={optionId}>{text ?? <Unresolved raw={optionId} />}</li>
            )
          })}
        </ul>
      )

    case 'number':
      // The unit comes from the snapshot, so an old row reads back with the
      // unit it was collected under.
      return question.unit ? <>{`${answer.value} ${question.unit}`}</> : <>{answer.value}</>

    case 'text':
      return <>{answer.value}</>

    case 'scaleRows':
      return (
        <ul className="admin__list">
          {Object.entries(answer.values).map(([rowId, rating]) => {
            const text = resolveRowText(question, rowId)
            return (
              <li key={rowId}>
                {text ?? <Unresolved raw={rowId} />}: <strong>{rating}</strong>
              </li>
            )
          })}
        </ul>
      )
  }
}

function Unresolved({ raw }: { raw: string }) {
  return (
    <span className="admin__unresolved">
      <code>{raw}</code> ({STRINGS.admin.unresolved})
    </span>
  )
}
