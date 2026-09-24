import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Screen } from '../components/Screen'
import { STRINGS } from '../data/strings'
import type { AudienceId } from '../data/types'
import { useQuestionnaire } from '../state/useQuestionnaire'
import './AudienceScreen.css'

const CHOICES: Array<{ id: AudienceId; text: string; icon: IconName }> = [
  { id: 'company', text: STRINGS.audience.company, icon: 'empresa' },
  { id: 'individual', text: STRINGS.audience.individual, icon: 'consumidor' },
]

export function AudienceScreen() {
  const { state, dispatch, steps } = useQuestionnaire()

  function choose(audience: AudienceId) {
    dispatch({ type: 'SET_AUDIENCE', audience })
    // buildSteps grows by one step as soon as an audience exists, so the
    // count passed here is the pre-change one; GO_NEXT only clamps upwards.
    dispatch({ type: 'GO_NEXT', stepCount: steps.length + 1 })
  }

  return (
    <Screen
      title={STRINGS.audience.title}
      subtitle={STRINGS.audience.subtitle}
      /* The fork is not a question with a list of answers: it is two doors.
         Centring is what costs nothing here — there is no common left edge to
         lose, because there is no list to run the eye down. */
      align="center"
      tone="panel"
      width="mid"
      actions={
        <Button variant="secondary" onClick={() => dispatch({ type: 'GO_BACK' })}>
          {STRINGS.actions.back}
        </Button>
      }
    >
      <ul className="audience">
        {CHOICES.map((choice) => (
          <li key={choice.id}>
            <button
              type="button"
              /* `on-page`: a white card inside the red field, so the palette
                 goes back to ink on cream for everything inside it. */
              className="audience__card on-page"
              data-selected={state.audience === choice.id || undefined}
              onClick={() => choose(choice.id)}
            >
              <span className="audience__icon" aria-hidden="true">
                <Icon name={choice.icon} />
              </span>
              <span className="audience__text">{choice.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
