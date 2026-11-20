import { ModuleLayout } from '../../components/ModuleLayout'
import { movingLifecycle } from '../../stores/moving'

export function MovingModule() {
  return <ModuleLayout id="moving" lifecycle={movingLifecycle} />
}
