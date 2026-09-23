import { useCallback, useEffect, useState } from 'react'
import { InvalidSessionError, listResponsesAdmin } from '../network/adminApi'
import type { AdminFilters, AdminListRow } from '../network/adminApi'
import { DetailScreen } from './DetailScreen'
import { ListScreen } from './ListScreen'
import { LoginScreen } from './LoginScreen'
import { STRINGS } from '../data/strings'
import './admin.css'

export function AdminApp() {
  // null = still checking. A 401 from the list endpoint IS the session check.
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [rows, setRows] = useState<AdminListRow[]>([])
  const [filters, setFilters] = useState<AdminFilters>({ direction: 'desc' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (next: AdminFilters) => {
    setLoading(true)
    try {
      setRows(await listResponsesAdmin(next))
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
    void load(filters)
    // Only on mount: later loads go through the filter form.
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
          void load(filters)
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
      filters={filters}
      loading={loading}
      error={error}
      onFiltersChange={setFilters}
      onApply={(next) => {
        setFilters(next)
        void load(next)
      }}
      onSelect={setSelectedId}
      onLoggedOut={() => setAuthenticated(false)}
    />
  )
}
