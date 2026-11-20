import { Hold } from '../../components/ModuleLayout'
import { receiptsLifecycle } from '../../stores/receipts'

export function ReceiptsHold() {
  return <Hold lifecycle={receiptsLifecycle} />
}
