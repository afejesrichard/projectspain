import type { ModuleId } from '../modules'
import { IconPackage, IconPlane, IconSun, IconWallet } from './icons'

export function ModuleIcon({ id, size = 16 }: { id: ModuleId; size?: number }) {
  if (id === 'budget') return <IconWallet size={size} />
  if (id === 'weekend') return <IconSun size={size} />
  if (id === 'flights') return <IconPlane size={size} />
  return <IconPackage size={size} />
}
