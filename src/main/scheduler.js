/**
 * 定时调度器 - 管理周期性截图分析
 */
class Scheduler {
  /**
   * @param {Function} task - 要执行的任务函数
   * @param {number} interval - 间隔时间（毫秒）
   */
  constructor(task, interval) {
    this.task = task;
    this.interval = interval;
    this.timer = null;
    this.running = false;
    this.isExecuting = false; // 防止重叠执行
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log(`[调度器] 已启动，间隔 ${this.interval / 1000} 秒`);
    // 启动后立即执行第一次任务，然后再按间隔调度
    this._runImmediate();
  }

  async _runImmediate() {
    this.isExecuting = true;
    try {
      console.log('[调度器] 首次立即执行...');
      await this.task();
    } catch (err) {
      console.error('[调度器] 首次任务执行失败:', err.message);
    } finally {
      this.isExecuting = false;
      this._schedule();
    }
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[调度器] 已停止');
  }

  updateInterval(newInterval) {
    this.interval = newInterval;
    if (this.running) {
      this.stop();
      this.start();
    }
    console.log(`[调度器] 间隔已更新为 ${newInterval / 1000} 秒`);
  }

  async _schedule() {
    if (!this.running) return;

    this.timer = setTimeout(async () => {
      if (this.isExecuting) {
        console.log('[调度器] 上一次任务还在执行，跳过本轮');
        this._schedule();
        return;
      }

      this.isExecuting = true;
      try {
        await this.task();
      } catch (err) {
        console.error('[调度器] 任务执行失败:', err.message);
      } finally {
        this.isExecuting = false;
        this._schedule();
      }
    }, this.interval);
  }
}

module.exports = { Scheduler };
