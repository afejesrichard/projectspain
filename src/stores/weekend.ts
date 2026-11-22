import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createModuleLifecycle, singleFlight } from '../lib/moduleLifecycle'
import { writeTile } from '../lib/tileCache'
import type { WeekendCurrent } from '../lib/weekend'
import { onSignOut } from './session'

// The Weekend module: one weekend_current() call when its route mounts
// (INVARIANT [LOAD-01]). No live channel: the scan writes once a week.

interface WeekendState {
  data: WeekendCurrent | null
  loading: boolean
  error: boolean
  load: () => Promise<void>
}

const initial = () => ({ data: null as WeekendCurrent | null, loading: false, error: false })

const loadOnce = singleFlight(async () => {
  const had = useWeekend.getState().data != null
  if (!had) useWeekend.setState({ loading: true, error: false })
  const { data, error } = await supabase.rpc('weekend_current')
  if (error || !data) {
    useWeekend.setState({ loading: false, error: !had })
    return
  }
  useWeekend.setState({ data: data as WeekendCurrent, loading: false, error: false })
})

export const useWeekend = create<WeekendState>(() => ({ ...initial(), load: loadOnce }))

onSignOut(() => useWeekend.setState(initial()))

// Home tile: the weekend's dates, how many programs, and the warning state.
useWeekend.subscribe((s, prev) => {
  if (s.data === prev.data) return
  const wx = s.data?.weather
  if (wx?.days?.length) writeTile('weather', { status: wx.status, lastDay: wx.days[wx.days.length - 1].date })
  const sc = s.data?.screen
  if (!sc) return
  writeTile('weekend', {
    from: sc.weekend_from,
    to: sc.weekend_to,
    count: sc.items.length,
    alert: sc.alert_status,
    stale: s.data!.stale,
  })
})

export const weekendLifecycle = createModuleLifecycle({
  load: () => useWeekend.getState().load(),
  subscribe: () => () => {},
})
