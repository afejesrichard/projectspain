import { ModuleLayout } from '../../components/ModuleLayout'
import { receiptsLifecycle } from '../../stores/receipts'

export function BudgetModule() {
  return <ModuleLayout id="budget" lifecycle={receiptsLifecycle} />
}
