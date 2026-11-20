import { ModuleLayout } from '../../components/ModuleLayout'
import { flightsLifecycle } from '../../stores/flights'

export function FlightsModule() {
  return <ModuleLayout id="flights" lifecycle={flightsLifecycle} />
}
