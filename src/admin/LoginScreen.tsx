import { useState } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { TextInput } from '../components/TextInput'
import { STRINGS } from '../data/strings'
import { InvalidSessionError, loginAdmin } from '../network/adminApi'

interface LoginScreenProps {
  error: string | null
  onAuthenticated: () => void
}

export function LoginScreen({ error, onAuthenticated }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(error)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await loginAdmin(password)
      setMessage(null)
      onAuthenticated()
    } catch (caught) {
      // Only an invalid session means "wrong password"; every other error
      // shows the server's own message verbatim.
      setMessage(
        caught instanceof InvalidSessionError
          ? STRINGS.admin.wrongPassword
          : caught instanceof Error
            ? caught.message
            : STRINGS.errors.generic,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title={STRINGS.admin.title}>
      <form
        className="admin__form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <TextInput
          label={STRINGS.admin.passwordLabel}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <Button type="submit" disabled={busy || password === ''}>
          {STRINGS.admin.login}
        </Button>
        {message && <StatusMessage tone="error">{message}</StatusMessage>}
      </form>
    </Screen>
  )
}
