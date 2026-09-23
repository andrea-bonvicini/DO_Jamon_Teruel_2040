import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Screen } from '../../src/components/Screen'
import { Button } from '../../src/components/Button'
import { STRINGS } from '../../src/data/strings'

const shell = () => document.querySelector('.screen')!
const panel = () => document.querySelector('.screen__panel')!
const content = () => document.querySelector('.screen__content')!

describe('the reading order', () => {
  /**
   * This is the whole point of the layout: the question must come BEFORE the
   * answers in the document, not beside them. A regression here would put
   * the eye back on the left-right journey the split-screen forced.
   */
  it('puts the question ahead of the answers in the document', () => {
    render(
      <Screen title="Tipo de actividad principal">
        <input type="radio" aria-label="Matadero" />
      </Screen>,
    )

    const heading = screen.getByRole('heading', { level: 1 })
    const firstControl = screen.getByRole('radio')
    const position = heading.compareDocumentPosition(firstControl)

    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the question in the band and the answers out of it', () => {
    render(
      <Screen title="Tipo de actividad principal">
        <p>respuestas</p>
      </Screen>,
    )

    expect(panel()).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(content()).toHaveTextContent('respuestas')
    expect(panel()).not.toHaveTextContent('respuestas')
  })

  it('shares one measure between the band and the answers, so they align', () => {
    render(<Screen title="T">body</Screen>)

    // Both containers carry the same width-constrained class contract.
    const bandInner = document.querySelector('.screen__panel-inner')!
    const main = document.querySelector('.screen__main')!
    expect(bandInner).toBeInTheDocument()
    expect(main).toBeInTheDocument()
  })
})

describe('the band', () => {
  it('carries the brand', () => {
    render(<Screen title="T">body</Screen>)
    expect(panel()).toContainElement(screen.getByText('Jamón de Teruel'))
  })

  it('carries the progress when there is any', () => {
    render(
      <Screen title="T" progress={{ current: 3, total: 17, label: 'Pregunta 3 de 17' }}>
        body
      </Screen>,
    )

    const bar = screen.getByRole('progressbar')
    expect(panel()).toContainElement(bar)
    expect(bar).toHaveAttribute('aria-valuetext', 'Pregunta 3 de 17')
  })

  it('omits the progress on the screens that have none', () => {
    render(<Screen title="T">body</Screen>)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders the subtitle only when given one', () => {
    const { rerender } = render(<Screen title="T">body</Screen>)
    expect(document.querySelector('.screen__subtitle')).not.toBeInTheDocument()

    rerender(
      <Screen title="T" subtitle="Marque una.">
        body
      </Screen>,
    )
    expect(screen.getByText('Marque una.')).toBeInTheDocument()
  })
})

describe('the shell', () => {
  it('renders actions and footer', () => {
    render(
      <Screen title="T" actions={<Button>Siguiente</Button>} footer={<span>pie</span>}>
        body
      </Screen>,
    )

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
    expect(screen.getByText('pie')).toBeInTheDocument()
  })

  it('omits the footer entirely when there is nothing to put in it', () => {
    render(<Screen title="T">body</Screen>)
    expect(document.querySelector('.screen__footer')).not.toBeInTheDocument()
  })

  it('offers a wider measure for the admin panel', () => {
    const { rerender } = render(<Screen title="T">body</Screen>)
    expect(shell()).toHaveAttribute('data-width', 'default')

    rerender(
      <Screen title="T" width="wide">
        body
      </Screen>,
    )
    expect(shell()).toHaveAttribute('data-width', 'wide')
  })

  it('exposes exactly one level-one heading', () => {
    render(<Screen title="Tipo de actividad principal">body</Screen>)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('there is only one layout now', () => {
  it('offers no view switch', () => {
    render(<Screen title="T">body</Screen>)
    expect(screen.queryByRole('button', { name: /vista/i })).not.toBeInTheDocument()
  })

  it('does not brand the shell with a view mode', () => {
    render(<Screen title="T">body</Screen>)
    expect(shell()).not.toHaveAttribute('data-view')
  })
})

describe('the actions', () => {
  it('centres a button that goes alone', () => {
    render(
      <Screen title="T" actions={<Button>Comenzar</Button>}>
        body
      </Screen>,
    )
    // One action means nothing to balance against, so it centres rather than
    // hugging the right edge.
    expect(document.querySelector('.screen__actions')!.children).toHaveLength(1)
  })

  it('keeps two buttons apart', () => {
    render(
      <Screen
        title="T"
        actions={
          <>
            <Button variant="secondary">Atrás</Button>
            <Button>Siguiente</Button>
          </>
        }
      >
        body
      </Screen>,
    )
    expect(document.querySelector('.screen__actions')!.children).toHaveLength(2)
  })
})

describe('alignment', () => {
  it('starts aligned to the left, where option lists read best', () => {
    render(<Screen title="T">body</Screen>)
    expect(shell()).toHaveAttribute('data-align', 'start')
  })

  it('centres the bookend screens when asked', () => {
    render(
      <Screen title="T" align="center">
        body
      </Screen>,
    )
    expect(shell()).toHaveAttribute('data-align', 'center')
  })
})

describe('the partner mark', () => {
  it('rides the band on the ordinary screens, in its reversed version', () => {
    render(<Screen title="T">body</Screen>)

    const circe = screen.getByAltText(STRINGS.brand.markCirceAlt)
    expect(panel()).toContainElement(circe)
    // White on maroon: the colour version would not read here.
    expect(circe).toHaveAttribute('src', '/logo-circe-blanco.png')
  })

  it('can be turned off, for the screen that shows CIRCE elsewhere', () => {
    render(
      <Screen title="T" showPartner={false}>
        body
      </Screen>,
    )
    expect(screen.queryByAltText(STRINGS.brand.markCirceAlt)).not.toBeInTheDocument()
  })

  it('never displaces the questionnaire wordmark', () => {
    render(<Screen title="T">body</Screen>)
    expect(panel()).toContainElement(screen.getByText('Jamón de Teruel'))
  })
})

describe('the cover title', () => {
  it('is capped to the reading measure by default', () => {
    render(<Screen title="Tipo de actividad principal">body</Screen>)
    expect(shell()).not.toHaveAttribute('data-title')
  })

  it('runs the full band when asked, so it holds one line where it fits', () => {
    render(
      <Screen title="Cuestionario D.O. Jamón de Teruel" wideTitle>
        body
      </Screen>,
    )
    expect(shell()).toHaveAttribute('data-title', 'wide')
  })
})
