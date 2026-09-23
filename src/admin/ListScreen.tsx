import { useState } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { STRINGS, format } from '../data/strings'
import { exportUrl, logoutAdmin } from '../network/adminApi'
import type { AdminFilters, AdminListRow } from '../network/adminApi'
import type { AudienceId } from '../data/types'

interface ListScreenProps {
  rows: AdminListRow[]
  filters: AdminFilters
  loading: boolean
  error: string | null
  onFiltersChange: (filters: AdminFilters) => void
  onApply: (filters: AdminFilters) => void
  onSelect: (id: string) => void
  onLoggedOut: () => void
}

export function ListScreen({
  rows,
  filters,
  loading,
  error,
  onApply,
  onSelect,
  onLoggedOut,
}: ListScreenProps) {
  // Draft filters: applied on submit, never debounced-on-type.
  const [draft, setDraft] = useState<AdminFilters>(filters)

  return (
    <Screen
      title={STRINGS.admin.title}
      width="wide"
      subtitle={
        <span className="admin__toolbar">
          <a className="admin__link" href={exportUrl('wide', filters)}>
            {STRINGS.admin.exportWide}
          </a>
          <a className="admin__link" href={exportUrl('long', filters)}>
            {STRINGS.admin.exportLong}
          </a>
          <Button
            variant="quiet"
            onClick={() => {
              void logoutAdmin().finally(onLoggedOut)
            }}
          >
            {STRINGS.admin.logout}
          </Button>
        </span>
      }
    >
      <form
        className="admin__filters"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
      >
        <label className="admin__filter">
          <span>{STRINGS.admin.search}</span>
          <input
            className="admin__input"
            type="search"
            value={draft.search ?? ''}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
        </label>

        <label className="admin__filter">
          <span>{STRINGS.admin.type}</span>
          <select
            className="admin__input"
            value={draft.type ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as AudienceId | '' })
            }
          >
            <option value="">{STRINGS.admin.all}</option>
            <option value="company">{STRINGS.admin.company}</option>
            <option value="individual">{STRINGS.admin.individual}</option>
          </select>
        </label>

        <label className="admin__filter">
          <span>{STRINGS.admin.direction}</span>
          <select
            className="admin__input"
            value={draft.direction ?? 'desc'}
            onChange={(event) =>
              setDraft({ ...draft, direction: event.target.value as 'asc' | 'desc' })
            }
          >
            <option value="desc">{STRINGS.admin.descending}</option>
            <option value="asc">{STRINGS.admin.ascending}</option>
          </select>
        </label>

        <Button type="submit" disabled={loading}>
          {STRINGS.admin.apply}
        </Button>
      </form>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      {/* The count is what makes a truncated export visible: compare it with
          the rows you get in the CSV. */}
      {!loading && rows.length > 0 && (
        <p className="admin__count">
          {rows.length === 1 ? STRINGS.admin.countOne : format(STRINGS.admin.count, { count: rows.length })}
        </p>
      )}

      {loading ? (
        <p className="admin__status">{STRINGS.admin.loading}</p>
      ) : rows.length === 0 ? (
        <p className="admin__status">{STRINGS.admin.empty}</p>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th scope="col">{STRINGS.admin.colDate}</th>
                <th scope="col">{STRINGS.admin.colType}</th>
                <th scope="col">{STRINGS.admin.colIdentification}</th>
                <th scope="col">{STRINGS.admin.colVersion}</th>
                <th scope="col">{STRINGS.admin.colAnswers}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="admin__row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(row.id)
                    }
                  }}
                >
                  <td>{formatDate(row.created_at)}</td>
                  <td>{audienceLabel(row.respondent_type)}</td>
                  <td>{summarise(row.identification)}</td>
                  <td>{row.questionnaire_version}</td>
                  <td>{Object.keys(row.answers ?? {}).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Screen>
  )
}

export function audienceLabel(type: AudienceId): string {
  return type === 'company' ? STRINGS.admin.company : STRINGS.admin.individual
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

/** Companies show their name here; consumers are anonymous, so it is empty. */
function summarise(identification: Record<string, string | number>): string {
  const values = Object.values(identification ?? {}).filter((value) => String(value).trim() !== '')
  return values.length ? values.join(' · ') : STRINGS.admin.anonymous
}
