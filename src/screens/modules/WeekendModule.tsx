import { ModuleLayout } from '../../components/ModuleLayout'
import { weekendLifecycle } from '../../stores/weekend'

export function WeekendModule() {
  return <ModuleLayout id="weekend" lifecycle={weekendLifecycle} />
}
