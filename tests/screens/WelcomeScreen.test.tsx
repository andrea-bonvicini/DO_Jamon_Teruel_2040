import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionnaireProvider } from '../../src/state/QuestionnaireContext'
import { WelcomeScreen } from '../../src/screens/WelcomeScreen'
import { STRINGS } from '../../src/data/strings'

function renderCover() {
  return render(
    <QuestionnaireProvider>
      <WelcomeScreen />
    </QuestionnaireProvider>,
  )
}

describe('the cover', () => {
  it('shows the three marks, each with alternative text', () => {
    renderCover()

    expect(screen.getByAltText(STRINGS.brand.markJamonAlt)).toHaveAttribute(
      'src',
      '/logo-jamon-de-teruel.png',
    )
    expect(screen.getByAltText(STRINGS.brand.markCerdoAlt)).toHaveAttribute(
      'src',
      '/logo-cerdo-de-teruel.png',
    )
    expect(screen.getByAltText(STRINGS.brand.markCirceAlt)).toHaveAttribute(
      'src',
      '/logo-circe.png',
    )
  })

  it('uses the colour CIRCE mark here, not the reversed one', () => {
    renderCover()
    // The white version only reads on the maroon band; the cover is cream.
    expect(screen.getByAltText(STRINGS.brand.markCirceAlt)).not.toHaveAttribute(
      'src',
      '/logo-circe-blanco.png',
    )
  })

  it('does not repeat CIRCE in the band as well', () => {
    renderCover()
    expect(screen.getAllByAltText(STRINGS.brand.markCirceAlt)).toHaveLength(1)
  })

  it('reserves the marks\u2019 space so the cover does not jump while they load', () => {
    renderCover()
    const jamon = screen.getByAltText(STRINGS.brand.markJamonAlt)
    expect(jamon).toHaveAttribute('width')
    expect(jamon).toHaveAttribute('height')
  })

  it('carries no invented emblem any more', () => {
    const { container } = renderCover()
    // The placeholder seal was an inline <svg>; the real marks are <img>.
    expect(container.querySelector('.seal')).toBeNull()
  })

  it('no longer repeats the privacy line that belongs on the consent screen', () => {
    renderCover()
    expect(screen.queryByText(/de forma agregada/)).not.toBeInTheDocument()
  })

  it('keeps the marks on cream, off the red field where they would vanish', () => {
    renderCover()
    const strip = document.querySelector('.screen__strip')!
    expect(strip).toContainElement(screen.getByAltText(STRINGS.brand.markJamonAlt))
    expect(strip).toContainElement(screen.getByAltText(STRINGS.brand.markCerdoAlt))
    expect(strip).toContainElement(screen.getByAltText(STRINGS.brand.markCirceAlt))
  })

  it('is one red field, with no cream reading area to separate', () => {
    renderCover()
    expect(document.querySelector('.screen')).toHaveAttribute('data-tone', 'panel')
  })

  it('still leads with the questionnaire title and a way in', () => {
    renderCover()
    expect(screen.getByRole('heading', { name: STRINGS.welcome.title })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: STRINGS.actions.start })).toBeInTheDocument()
  })
})
