// The app's modules, in the order the home grid, drawer and sidebar show them.
// Everything that decides "which module am I in" or "where does back go" reads
// this list, so a new module is one entry here plus its routes in App.tsx.

export type ModuleId = 'budget' | 'weekend' | 'flights' | 'moving'

export interface ModuleView {
  to: string
  label: string
  end?: boolean
}

export interface ModuleDef {
  id: ModuleId
  title: string
  path: string
  // Path prefixes that belong to this module.
  prefixes: string[]
  // Views inside the module, shown as tabs and in the navigation.
  views?: ModuleView[]
}

export const MODULES: ModuleDef[] = [
  {
    id: 'budget',
    title: 'Költségvetés',
    path: '/koltsegvetes',
    prefixes: ['/koltsegvetes'],
    views: [{ to: '/koltsegvetes/nyugtak', label: 'Nyugták' }],
  },
  { id: 'weekend', title: 'Hétvége', path: '/hetvege', prefixes: ['/hetvege'] },
  { id: 'flights', title: 'Repjegy', path: '/repjegy', prefixes: ['/repjegy'] },
  {
    id: 'moving',
    title: 'Költözés',
    path: '/koltozes',
    prefixes: ['/koltozes', '/leltar', '/dobozok'],
    views: [
      { to: '/koltozes', label: 'Áttekintés', end: true },
      { to: '/leltar', label: 'Leltár' },
      { to: '/dobozok', label: 'Dobozok' },
    ],
  },
]

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function moduleFor(pathname: string): ModuleDef | null {
  return MODULES.find((m) => m.prefixes.some((p) => under(pathname, p))) ?? null
}

// Detail screens and where their back arrow leads. A module's own views are
// not sub-screens: from those, the app name returns home.
const DETAIL_PARENTS = ['/leltar', '/dobozok', '/koltsegvetes/nyugtak']

export function parentOf(pathname: string): string | null {
  for (const parent of DETAIL_PARENTS) {
    if (pathname.startsWith(parent + '/') && pathname.length > parent.length + 1) return parent
  }
  return null
}
