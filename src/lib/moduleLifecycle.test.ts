import { describe, expect, it, vi } from 'vitest'
import { createModuleLifecycle, singleFlight } from './moduleLifecycle'

function setup() {
  const unsubscribe = vi.fn()
  const subscribe = vi.fn(() => unsubscribe)
  const load = vi.fn()
  const life = createModuleLifecycle({ load, subscribe })
  return { life, load, subscribe, unsubscribe }
}

describe('createModuleLifecycle', () => {
  it('does nothing until acquired', () => {
    const { life, load, subscribe } = setup()
    expect(load).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    expect(life.active).toBe(false)
  })

  it('subscribes before loading on first acquire', () => {
    const order: string[] = []
    const life = createModuleLifecycle({
      load: () => order.push('load'),
      subscribe: () => {
        order.push('subscribe')
        return () => {}
      },
    })
    life.acquire()
    expect(order).toEqual(['subscribe', 'load'])
  })

  it('shares one subscription between holders and tears down after the last', () => {
    const { life, load, subscribe, unsubscribe } = setup()
    const a = life.acquire()
    const b = life.acquire()
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
    a()
    expect(unsubscribe).not.toHaveBeenCalled()
    b()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(life.active).toBe(false)
  })

  it('ignores a release called twice', () => {
    const { life, unsubscribe } = setup()
    const a = life.acquire()
    const b = life.acquire()
    a()
    a()
    expect(unsubscribe).not.toHaveBeenCalled()
    b()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('reloads and resubscribes on a later visit', () => {
    const { life, load, subscribe } = setup()
    life.acquire()()
    life.acquire()
    expect(subscribe).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('singleFlight', () => {
  it('collapses concurrent calls and allows a new one after settling', async () => {
    let resolve!: () => void
    const fn = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const run = singleFlight(fn)
    const p1 = run()
    const p2 = run()
    expect(p1).toBe(p2)
    expect(fn).toHaveBeenCalledTimes(1)
    resolve()
    await p1
    run()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
