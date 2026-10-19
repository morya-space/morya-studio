import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PollScheduler } from '../scheduler'

describe('PollScheduler', () => {
  let scheduler: PollScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new PollScheduler()
  })

  afterEach(() => {
    scheduler.disposeAll()
    vi.useRealTimers()
  })

  it('runs task at interval', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    scheduler.start('c1', 1000, task)
    expect(scheduler.isRunning('c1')).toBe(true)

    await vi.advanceTimersByTimeAsync(3000)
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('does not start timer when interval <= 0', () => {
    const task = vi.fn()
    scheduler.start('c1', 0, task)
    expect(scheduler.isRunning('c1')).toBe(false)
  })

  it('stop clears the timer', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    scheduler.start('c1', 1000, task)
    scheduler.stop('c1')
    expect(scheduler.isRunning('c1')).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(task).not.toHaveBeenCalled()
  })

  it('restarting replaces the old timer', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    scheduler.start('c1', 1000, task)
    scheduler.start('c1', 500, task) // 重启
    expect(scheduler.activeCount).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(2) // 500ms * 2
  })

  it('stopAll clears all timers', async () => {
    const t1 = vi.fn().mockResolvedValue(undefined)
    const t2 = vi.fn().mockResolvedValue(undefined)
    scheduler.start('c1', 1000, t1)
    scheduler.start('c2', 1000, t2)
    expect(scheduler.activeCount).toBe(2)
    scheduler.stopAll()
    expect(scheduler.activeCount).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(t1).not.toHaveBeenCalled()
    expect(t2).not.toHaveBeenCalled()
  })

  it('pause/resume preserves tasks', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    scheduler.start('c1', 1000, task)
    scheduler.pause()
    expect(scheduler.isRunning('c1')).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(task).not.toHaveBeenCalled()

    scheduler.resume()
    expect(scheduler.isRunning('c1')).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('multiple cards schedule independently', async () => {
    const fast = vi.fn().mockResolvedValue(undefined)
    const slow = vi.fn().mockResolvedValue(undefined)
    scheduler.start('fast', 500, fast)
    scheduler.start('slow', 2000, slow)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fast).toHaveBeenCalledTimes(4)
    expect(slow).toHaveBeenCalledTimes(1)
  })

  it('does not overlap a slow task for the same card', async () => {
    let resolveTask: (() => void) | undefined
    const task = vi.fn(() => new Promise<void>(resolve => { resolveTask = resolve }))
    scheduler.start('c1', 1000, task)

    await vi.advanceTimersByTimeAsync(3000)
    expect(task).toHaveBeenCalledTimes(1)

    resolveTask?.()
    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
