import { lazy, Suspense } from 'react'
import { QuestionnaireFlow } from './screens/QuestionnaireFlow'
import { QrScreen } from './screens/QrScreen'
import { StyleGuide } from './screens/StyleGuide'

const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))

/**
 * Three entry points, resolved by pathname. No router library — blueprint §2.
 * The SPA rewrite in vercel.json sends every path to index.html.
 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/admin') {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    )
  }

  if (path === '/qr') return <QrScreen />

  // Development aid, never linked from the flow.
  if (path === '/styleguide' && import.meta.env.DEV) return <StyleGuide />

  return <QuestionnaireFlow />
}
