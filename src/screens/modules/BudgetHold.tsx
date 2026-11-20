import { Hold } from '../../components/ModuleLayout'
import { budgetLifecycle } from '../../stores/budget'

export function BudgetHold() {
  return <Hold lifecycle={budgetLifecycle} />
}
