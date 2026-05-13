import type { HeartbeatScheduler, Scheduler } from "./types.js";

export class DefaultHeartbeatScheduler implements HeartbeatScheduler {
  private readonly scheduler: Scheduler;
  private cancelFn: (() => void) | null = null;

  constructor(scheduler: Scheduler) {
    this.scheduler = scheduler;
  }

  start(intervalMs: number, onTick: () => void): void {
    if (this.cancelFn !== null) {
      this.dispose();
    }
    this.cancelFn = this.scheduler.setInterval(onTick, intervalMs);
  }

  stop(): void {
    if (this.cancelFn !== null) {
      this.cancelFn();
      this.cancelFn = null;
    }
  }

  dispose(): void {
    this.stop();
  }
}
