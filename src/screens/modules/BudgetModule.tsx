import { ModuleLayout } from '../../components/ModuleLayout'

// The Budget module's frame (tabs). Its two halves hold their own data:
// BudgetHold for Month and Lines, ReceiptsHold for the receipts views.
export function BudgetModule() {
  return <ModuleLayout id="budget" />
}
