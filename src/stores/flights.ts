import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createModuleLifecycle, singleFlight } from '../lib/moduleLifecycle'
import { writeTile } from '../lib/tileCache'
import { computeBoard, localToday, type FareSettings, type Leg, type Party, type Trip } from '../lib/fares'
import { onSignOut } from './session'

// The Flights module: the fare log and the party settings, loaded when its
// route mounts and kept live while it is open (INVARIANT [LOAD-01]), so a trip
// logged on one phone appears on the other.

interface QuoteRow {
  id: string
  kind: 'return' | 'leg'
  party: Party | null
  out_date: string | null
  ret_date: string | null
  out_dep: string | null
  out_arr: string | null
  ret_dep: string | null
  ret_arr: string | null
  out_carrier: string | null
  ret_carrier: string | null
  price_cents: number
  party_price_cents: number | null
  travel_date: string | null
  direction: 'BCN-BUD' | 'BUD-BCN' | null
  carrier: string | null
  note: string
  source: 'scan' | 'manual'
  found_at: string
}

function toTrip(r: QuoteRow): Trip {
  return {
    id: r.id,
    party: r.party ?? 'family',
    outDate: r.out_date!,
    retDate: r.ret_date!,
    outDep: r.out_dep ?? '',
    outArr: r.out_arr ?? '',
    retDep: r.ret_dep ?? '',
    retArr: r.ret_arr ?? '',
    outCarrier: r.out_carrier ?? '?',
    retCarrier: r.ret_carrier ?? '?',
    priceCents: Number(r.price_cents),
    partyPriceCents: r.party_price_cents == null ? null : Number(r.party_price_cents),
    note: r.note,
    source: r.source,
    foundAt: r.found_at,
  }
}

function toLeg(r: QuoteRow): Leg {
  return {
    id: r.id,
    travelDate: r.travel_date!,
    direction: r.direction ?? 'BCN-BUD',
    carrier: r.carrier ?? '?',
    priceCents: Number(r.price_cents),
    note: r.note,
    source: r.source,
    foundAt: r.found_at,
  }
}

export interface NewTrip {
  party: Party
  outDate: string
  retDate: string
  outDep: string
  outArr: string
  retDep: string
  retArr: string
  outCarrier: string
  retCarrier: string
  priceCents: number
  partyPriceCents: number | null
  note: string
}

interface FlightsState {
  trips: Trip[]
  legs: Leg[]
  settings: FareSettings | null
  loading: boolean
  error: boolean
  load: () => Promise<void>
  addTrip: (t: NewTrip) => Promise<boolean>
  removeQuote: (id: string) => Promise<boolean>
}

const initial = () => ({ trips: [] as Trip[], legs: [] as Leg[], settings: null as FareSettings | null, loading: false, error: false })

function upsertRow(r: QuoteRow) {
  useFlights.setState((s) =>
    r.kind === 'leg'
      ? { legs: [...s.legs.filter((l) => l.id !== r.id), toLeg(r)] }
      : { trips: [...s.trips.filter((t) => t.id !== r.id), toTrip(r)] },
  )
}

const loadOnce = singleFlight(async () => {
  const had = useFlights.getState().settings != null
  if (!had) useFlights.setState({ loading: true, error: false })
  const [q, st] = await Promise.all([
    supabase.from('fare_quotes').select('*').order('found_at', { ascending: false }),
    supabase.from('app_settings').select('value').eq('key', 'fares').maybeSingle(),
  ])
  if (q.error || st.error || !st.data) {
    useFlights.setState({ loading: false, error: !had })
    return
  }
  const rows = q.data as QuoteRow[]
  useFlights.setState({
    trips: rows.filter((r) => r.kind === 'return').map(toTrip),
    legs: rows.filter((r) => r.kind === 'leg').map(toLeg),
    settings: st.data.value as FareSettings,
    loading: false,
    error: false,
  })
})

export const useFlights = create<FlightsState>((set) => ({
  ...initial(),
  load: loadOnce,

  addTrip: async (t) => {
    const id = `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const row = {
      id,
      kind: 'return',
      party: t.party,
      origin: t.party === 'grandparents' ? 'BUD' : 'BCN',
      out_date: t.outDate,
      ret_date: t.retDate,
      out_dep: t.outDep || null,
      out_arr: t.outArr || null,
      ret_dep: t.retDep || null,
      ret_arr: t.retArr || null,
      out_carrier: t.outCarrier,
      ret_carrier: t.retCarrier,
      price_cents: t.priceCents,
      party_price_cents: t.partyPriceCents,
      note: t.note,
      source: 'manual',
    }
    const { data, error } = await supabase.from('fare_quotes').insert(row).select('*').single()
    if (error || !data) return false
    upsertRow(data as QuoteRow)
    return true
  },

  removeQuote: async (id) => {
    const { error } = await supabase.from('fare_quotes').delete().eq('id', id)
    if (error) return false
    set((s) => ({ trips: s.trips.filter((t) => t.id !== id), legs: s.legs.filter((l) => l.id !== id) }))
    return true
  },
}))

onSignOut(() => useFlights.setState(initial()))

// Home tile: how many deals sit below average right now.
useFlights.subscribe((s, prev) => {
  if (!s.settings || (s.trips === prev.trips && s.settings === prev.settings)) return
  const b = computeBoard(s.trips, s.legs, s.settings, localToday(), Date.now())
  writeTile('flights', { deals: b.dealCount, trips: s.trips.length, at: localToday(), lastScan: b.lastScan })
})

let channelSeq = 0

function subscribeFlights(): () => void {
  const channel = supabase
    .channel(`flights-live-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fare_quotes' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as { id?: string }).id
        useFlights.setState((s) => ({ trips: s.trips.filter((t) => t.id !== id), legs: s.legs.filter((l) => l.id !== id) }))
        return
      }
      upsertRow(payload.new as QuoteRow)
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export const flightsLifecycle = createModuleLifecycle({
  load: () => useFlights.getState().load(),
  subscribe: subscribeFlights,
})
