/**
 * 轮询调度器（v0.2）
 * 每张卡片一个定时器，按 dataSource.pollInterval 独立调度。
 * 页面不可见时自动暂停，可见时恢复（需重启任务）。
 * 契约见 docs/DESIGN-DEV.md §6.4。
 */

export interface ScheduledTask {
  cardId: string
  interval: number
  task: () => Promise<void>
}

export class PollScheduler {
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private tasks = new Map<string, ScheduledTask>()
  private running = new Set<string>()
  private paused = false
  private visibilityBound = false

  /**
   * 启动某卡片的轮询。重复调用会先停旧定时器再启新的。
   * interval <= 0 时不启动（仅记录任务，便于后续手动 refresh）。
   */
  start(cardId: string, interval: number, task: () => Promise<void>): void {
    this.stop(cardId)
    this.tasks.set(cardId, { cardId, interval, task })
    if (interval <= 0 || this.paused) return
    this.timers.set(cardId, setInterval(() => { void this.run(cardId, task) }, interval))
    this.bindVisibility()
  }

  /** 停止并移除某卡片任务 */
  stop(cardId: string): void {
    const timer = this.timers.get(cardId)
    if (timer !== undefined) {
      clearInterval(timer)
      this.timers.delete(cardId)
    }
    this.tasks.delete(cardId)
  }

  /** 停止所有定时器（页面离开时调用），但保留任务以便恢复 */
  stopAll(): void {
    for (const timer of this.timers.values()) clearInterval(timer)
    this.timers.clear()
  }

  /** 完全清空（连任务定义一起） */
  disposeAll(): void {
    this.stopAll()
    this.tasks.clear()
    this.running.clear()
  }

  /** 当前活跃的定时器数量（测试用） */
  get activeCount(): number {
    return this.timers.size
  }

  /** 某卡片是否有活跃定时器 */
  isRunning(cardId: string): boolean {
    return this.timers.has(cardId)
  }

  /** 暂停所有（不删除任务定义） */
  pause(): void {
    if (this.paused) return
    this.paused = true
    this.stopAll()
  }

  /** 恢复所有已注册任务 */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    for (const { cardId, interval, task } of this.tasks.values()) {
      if (interval > 0 && !this.timers.has(cardId)) {
        this.timers.set(cardId, setInterval(() => { void this.run(cardId, task) }, interval))
      }
    }
  }

  /** 监听页面可见性：隐藏暂停，可见恢复 */
  private bindVisibility(): void {
    if (this.visibilityBound) return
    if (typeof document === 'undefined' || !document.addEventListener) return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause()
      else this.resume()
    })
  }

  private async run(cardId: string, task: () => Promise<void>): Promise<void> {
    if (this.running.has(cardId)) return
    this.running.add(cardId)
    try {
      await task()
    } finally {
      this.running.delete(cardId)
    }
  }
}

/** 全局单例 */
export const pollScheduler = new PollScheduler()
