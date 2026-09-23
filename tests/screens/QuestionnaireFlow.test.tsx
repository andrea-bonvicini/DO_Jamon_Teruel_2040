import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireFlow } from '../../src/screens/QuestionnaireFlow'
import { STRINGS } from '../../src/data/strings'

function stubFetchOk() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: 'new-id' }),
  }) as unknown as typeof fetch
}

const next = () => screen.getByRole('button', { name: STRINGS.actions.next })
const back = () => screen.getByRole('button', { name: STRINGS.actions.back })

/** Welcome → audience → identification, leaving the first question on screen. */
async function startAs(user: ReturnType<typeof userEvent.setup>, audience: 'company' | 'individual') {
  await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(audience === 'company' ? 'empresa del sector' : 'consumidor', 'i'),
    }),
  )
  // Companies are a named census; consumers are anonymous.
  if (audience === 'company') {
    await user.type(screen.getByLabelText('Nombre de la empresa'), 'Secaderos de Teruel S.L.')
  }
  await user.click(screen.getByRole('checkbox', { name: STRINGS.identification.privacyLabel }))
  await user.click(next())
}

describe('the respondent flow', () => {
  it('starts on the welcome screen', () => {
    render(<QuestionnaireFlow />)
    expect(screen.getByRole('heading', { name: STRINGS.welcome.title })).toBeInTheDocument()
  })

  it('offers both audiences, and no longer promises a duration', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))

    expect(screen.getByRole('button', { name: /empresa del sector/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /consumidor/i })).toBeInTheDocument()

    // The estimate was dropped: it set an expectation the survey could miss.
    expect(screen.queryByText(/min/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Duración/i)).not.toBeInTheDocument()
  })

  it('blocks the identification step until consent is given', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
    await user.click(screen.getByRole('button', { name: /consumidor/i }))

    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: STRINGS.identification.privacyLabel }))
    expect(next()).toBeEnabled()
  })

  it('asks consumers for no identifying data and promises anonymity', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
    await user.click(screen.getByRole('button', { name: /consumidor/i }))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(/de forma anónima/)).toBeInTheDocument()
    expect(screen.getByText(/RGPD/)).toBeInTheDocument()
  })

  it('requires a company name, and does not promise companies anonymity', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
    await user.click(screen.getByRole('button', { name: /empresa del sector/i }))

    const field = screen.getByLabelText('Nombre de la empresa')
    expect(field).toBeInTheDocument()

    // Consent alone is no longer enough for a company.
    await user.click(screen.getByRole('checkbox', { name: STRINGS.identification.privacyLabel }))
    expect(next()).toBeDisabled()

    await user.type(field, 'Secaderos de Teruel S.L.')
    expect(next()).toBeEnabled()

    expect(screen.getByText(/forma confidencial/)).toBeInTheDocument()
    expect(screen.queryByText(/de forma anónima/)).not.toBeInTheDocument()
    expect(screen.getByText(/RGPD/)).toBeInTheDocument()
  })

  it('keeps the company name when navigating back to it', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'company')

    await user.click(screen.getByRole('radio', { name: 'Matadero' }))
    await user.click(back())

    expect(screen.getByLabelText('Nombre de la empresa')).toHaveValue('Secaderos de Teruel S.L.')
  })

  it('shows one question per screen, with a progress denominator', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'company')

    expect(screen.getByRole('heading', { name: 'Tipo de actividad principal' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Pregunta 1 de 17')
  })

  it('keeps Next disabled until a required question is answered', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'company')

    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Matadero' }))
    expect(next()).toBeEnabled()
  })

  it('preserves the answer when navigating back', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'company')

    await user.click(screen.getByRole('radio', { name: 'Matadero' }))
    await user.click(next())
    expect(screen.getByRole('heading', { name: /personas empleadas/i })).toBeInTheDocument()

    await user.click(back())
    expect(screen.getByRole('radio', { name: 'Matadero' })).toBeChecked()
  })

  it('caps a "máximo 3" question by disabling the remaining options', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'company')

    // Walk to C-Q08 (limitantes), the first capped question.
    await user.click(screen.getByRole('radio', { name: 'Matadero' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: '6–20' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: '10–25' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: '25–50 %' }))
    await user.click(next())
    await user.click(screen.getByRole('checkbox', { name: 'Local/provincial' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Ha crecido' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Crecerá' }))
    await user.click(next())

    expect(screen.getByRole('heading', { name: /principales limitantes/i })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Precio de venta/ }))
    await user.click(screen.getByRole('checkbox', { name: /Costes energéticos/ }))
    await user.click(screen.getByRole('checkbox', { name: /Carga normativa/ }))

    expect(screen.getByRole('checkbox', { name: /Sanidad animal/ })).toBeDisabled()
    // An already-checked option stays clickable so the choice can be changed.
    expect(screen.getByRole('checkbox', { name: /Carga normativa/ })).toBeEnabled()
  })

  it('renders the 19-option comunidad autónoma question as a select', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'individual')

    await user.click(screen.getByRole('radio', { name: '30–44' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Mujer' }))
    await user.click(next())

    const select = screen.getByRole('combobox')
    expect(within(select).getAllByRole('option')).toHaveLength(20) // 19 + placeholder
    await user.selectOptions(select, 'aragon')
    expect(next()).toBeEnabled()
  })

  it('requires every row of the rating grid before continuing', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'individual')

    await user.click(screen.getByRole('radio', { name: '30–44' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Mujer' }))
    await user.click(next())
    await user.selectOptions(screen.getByRole('combobox'), 'aragon')
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Rural/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Yo, principalmente' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Semanal' }))
    await user.click(next())
    await user.click(screen.getByRole('checkbox', { name: /Aperitivo/ }))
    await user.click(next())
    await user.click(screen.getByRole('checkbox', { name: /Supermercado/ }))
    await user.click(next())

    // The grid: 13 rows, each its own radiogroup.
    const groups = screen.getAllByRole('radiogroup')
    expect(groups).toHaveLength(13)
    expect(next()).toBeDisabled()

    for (const group of groups) {
      await user.click(within(group).getByRole('radio', { name: '4' }))
    }
    expect(next()).toBeEnabled()
  })

  it('takes a respondent who never eats jamón straight to the thank-you screen', async () => {
    stubFetchOk()
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'individual')

    await user.click(screen.getByRole('radio', { name: '30–44' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Mujer' }))
    await user.click(next())
    await user.selectOptions(screen.getByRole('combobox'), 'aragon')
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Rural/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Yo, principalmente' }))
    await user.click(next())

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Pregunta 6 de 6')
    await user.click(screen.getByRole('radio', { name: 'Nunca' }))
    await user.click(next())

    expect(await screen.findByText(STRINGS.thankYou.sent)).toBeInTheDocument()
  })

  it('grows the flow from 6 to 20 questions when the respondent does eat jamón', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'individual')

    await user.click(screen.getByRole('radio', { name: '30–44' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Mujer' }))
    await user.click(next())
    await user.selectOptions(screen.getByRole('combobox'), 'aragon')
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Rural/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Yo, principalmente' }))
    await user.click(next())

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Pregunta 6 de 6')
    await user.click(screen.getByRole('radio', { name: 'Semanal' }))
    await user.click(next())
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Pregunta 7 de 20')
  })

  it('rejects a price outside the accepted range and explains why', async () => {
    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await startAs(user, 'individual')

    await user.click(screen.getByRole('radio', { name: '30–44' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Mujer' }))
    await user.click(next())
    await user.selectOptions(screen.getByRole('combobox'), 'aragon')
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /Rural/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Yo, principalmente' }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: 'Semanal' }))
    await user.click(next())
    await user.click(screen.getByRole('checkbox', { name: /Aperitivo/ }))
    await user.click(next())
    await user.click(screen.getByRole('checkbox', { name: /Supermercado/ }))
    await user.click(next())
    for (const group of screen.getAllByRole('radiogroup')) {
      await user.click(within(group).getByRole('radio', { name: '4' }))
    }
    await user.click(next())

    // First Van Westendorp question.
    const field = screen.getByRole('textbox')
    await user.type(field, '99999')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(next()).toBeDisabled()

    await user.clear(field)
    // Spanish decimal comma is accepted.
    await user.type(field, '12,5')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(next()).toBeEnabled()
  })
})
