import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { STRINGS } from '../data/strings'
import { useQuestionnaire } from '../state/useQuestionnaire'
import './WelcomeScreen.css'

export function WelcomeScreen() {
  const { dispatch, steps } = useQuestionnaire()

  return (
    <Screen
      title={STRINGS.welcome.title}
      align="center"
      tone="panel"
      showPartner={false}
      wideTitle
      actions={
        <Button onClick={() => dispatch({ type: 'GO_NEXT', stepCount: steps.length })}>
          {STRINGS.actions.start}
        </Button>
      }
      /* The real marks sit in the cream strip at the foot: the Teruel ones are
         red and pink on transparent and would disappear on the red field.
         The three carry equal weight at the project owner's request. */
      strip={
        <div className="cover">
          <img
            className="cover__mark cover__mark--jamon"
            src="/logo-jamon-de-teruel.png"
            alt={STRINGS.brand.markJamonAlt}
            width={129}
            height={155}
          />
          <span className="cover__rule" />
          <img
            className="cover__mark cover__mark--cerdo"
            src="/logo-cerdo-de-teruel.png"
            alt={STRINGS.brand.markCerdoAlt}
            width={135}
            height={68}
          />
          <span className="cover__rule" />
          <img
            className="cover__mark cover__mark--circe"
            src="/logo-circe.png"
            alt={STRINGS.brand.markCirceAlt}
            width={1022}
            height={567}
          />
        </div>
      }
    />
  )
}
