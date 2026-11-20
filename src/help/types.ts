// Help content is data: each module keeps its entries in src/help/<module>.ts,
// keyed by id, so the text ships in that module's chunk and nowhere else.

// A paragraph, a bullet list, or a small heading inside a longer guide.
export type HelpBlock = string | { list: string[] } | { heading: string }

export interface HelpEntry {
  title: string
  body: HelpBlock[]
}

// An entry may be computed from live data (e.g. dates that depend on today).
// (`never` accepts a function of any parameter type; resolveHelp passes the data.)
export type HelpSource = HelpEntry | ((data: never) => HelpEntry)

export type HelpMap = Record<string, HelpSource>

export function resolveHelp(source: HelpSource, data?: unknown): HelpEntry {
  return typeof source === 'function' ? (source as (d: unknown) => HelpEntry)(data) : source
}
