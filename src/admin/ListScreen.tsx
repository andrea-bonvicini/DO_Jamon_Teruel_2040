import { useState } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { STRINGS, format } from '../data/strings'
import { exportUrl, logoutAdmin } from '../network/adminApi'
import type { AdminCounts, AdminFilters, AdminListRow } from '../network/adminApi'
import type { AudienceId } from '../data/types'

interface ListScreenProps {
  rows: AdminListRow[]
  counts: AdminCounts
  audience: AudienceId
  filters: AdminFilters
  loading: boolean
  error: string | null
  onAudienceChange: (audience: AudienceId) => void
  onApply: (filters: AdminFilters) => void
  onSelect: (id: string) => void
  onLoggedOut: () => void
}

const TABS: Array<{ id: AudienceId; label: string }> = [
  { id: 'company', label: STRINGS.admin.tabCompany },
  { id: 'individual', label: STRINGS.admin.tabIndividual },
]

export function ListScreen({
  rows,
  counts,
  audience,
  filters,
  loading,
  error,
  onAudienceChange,
  onApply,
  onSelect,
  onLoggedOut,
}: ListScreenProps) {
  // Draft filters: applied on submit, never debounced-on-type.
  const [draft, setDraft] = useState<AdminFilters>(filters)

  // Companies give their name; consumers are anonymous by design, so a search
  // box on that tab could never match anything.
  const searchable = audience === 'company'
  // The export always carries the tab, so you download what you are looking at.
  const exportFilters: AdminFilters = { ...filters, type: audience }

  return (
    <Screen
      title={STRINGS.admin.title}
      width="wide"
      subtitle={
        <>
          {/* Two choices, so `aria-current` rather than the full ARIA tabs
              pattern: that needs tabpanels and arrow-key navigation, and half
              of it would be worse than none. */}
          <nav className="admin__tabs" aria-label={STRINGS.admin.tabsLabel}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="admin__tab"
                aria-current={tab.id === audience ? 'page' : undefined}
                onClick={() => tab.id !== audience && onAudienceChange(tab.id)}
              >
                {tab.label}
                <span className="admin__tab-count">{counts[tab.id]}</span>
              </button>
            ))}
          </nav>

          <span className="admin__toolbar">
            <a className="admin__link" href={exportUrl('matrix', exportFilters)}>
              {STRINGS.admin.exportMatrix}
            </a>
            <a className="admin__link" href={exportUrl('frequency', exportFilters)}>
              {STRINGS.admin.exportFrequency}
            </a>
            <a className="admin__link" href={exportUrl('codebook', exportFilters)}>
              {STRINGS.admin.exportCodebook}
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
        </>
      }
    >
      <form
        className="admin__filters"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
      >
        {searchable && (
          <label className="admin__filter">
            <span>{STRINGS.admin.search}</span>
            <input
              className="admin__input"
              type="search"
              value={draft.search ?? ''}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            />
          </label>
        )}

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
          {rows.length === 1
            ? STRINGS.admin.countOne
            : format(STRINGS.admin.count, { count: rows.length })}
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
                {searchable && <th scope="col">{STRINGS.admin.colCompanyName}</th>}
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
                  {searchable && <td>{summarise(row.identification)}</td>}
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

/** Companies show their name here; consumers never reach this column. */
function summarise(identification: Record<string, string | number>): string {
  const values = Object.values(identification ?? {}).filter((value) => String(value).trim() !== '')
  return values.length ? values.join(' · ') : STRINGS.admin.anonymous
}
