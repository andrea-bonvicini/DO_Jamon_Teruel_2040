import { useCallback, useEffect, useState } from 'react'
import { InvalidSessionError, listResponsesAdmin } from '../network/adminApi'
import type { AdminCounts, AdminFilters, AdminListRow } from '../network/adminApi'
import type { AudienceId } from '../data/types'
import { DetailScreen } from './DetailScreen'
import { ListScreen } from './ListScreen'
import { LoginScreen } from './LoginScreen'
import { STRINGS } from '../data/strings'
import './admin.css'

const NO_COUNTS: AdminCounts = { company: 0, individual: 0 }

export function AdminApp() {
  // null = still checking. A 401 from the list endpoint IS the session check.
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [rows, setRows] = useState<AdminListRow[]>([])
  const [counts, setCounts] = useState<AdminCounts>(NO_COUNTS)
  /**
   * The questionnaire being looked at. Not a filter among others: the two
   * surveys ask different questions, so the panel treats them as two places.
   */
  const [audience, setAudience] = useState<AudienceId>('company')
  const [filters, setFilters] = useState<AdminFilters>({ direction: 'desc' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (next: AdminFilters, forAudience: AudienceId) => {
    setLoading(true)
    try {
      const result = await listResponsesAdmin({ ...next, type: forAudience })
      setRows(result.responses)
      setCounts(result.counts ?? NO_COUNTS)
      setError(null)
      setAuthenticated(true)
    } catch (caught) {
      if (caught instanceof InvalidSessionError) {
        setAuthenticated(false)
        setError(null)
      } else {
        // Any other failure forces `false` rather than hanging on
        // "Comprobando la sesión…", and passes the message down.
        setAuthenticated(false)
        setError(caught instanceof Error ? caught.message : STRINGS.errors.generic)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filters, audience)
    // Only on mount: later loads go through the tabs and the filter form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (authenticated === null) {
    return <p className="admin__status">{STRINGS.admin.checkingSession}</p>
  }

  if (!authenticated) {
    return (
      <LoginScreen
        error={error}
        onAuthenticated={() => {
          setError(null)
          void load(filters, audience)
        }}
      />
    )
  }

  if (selectedId) {
    return <DetailScreen id={selectedId} onBack={() => setSelectedId(null)} />
  }

  return (
    <ListScreen
      rows={rows}
      counts={counts}
      audience={audience}
      filters={filters}
      loading={loading}
      error={error}
      onAudienceChange={(next) => {
        setAudience(next)
        // The search only applies to company names, so it is dropped when
        // moving to the consumer tab rather than silently filtering nothing.
        const clean: AdminFilters = { ...filters, search: '' }
        setFilters(clean)
        void load(clean, next)
      }}
      onApply={(next) => {
        setFilters(next)
        void load(next, audience)
      }}
      onSelect={setSelectedId}
      onLoggedOut={() => setAuthenticated(false)}
    />
  )
}
