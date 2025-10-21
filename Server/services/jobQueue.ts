// Simple in-memory job queue with retry/backoff and basic metrics
// Suitable for single-node usage. Swap with BullMQ/Redis for horizontal scaling.

export type JobName = 'persist-chat';

export interface Job<T = any> {
  id: string;
  name: JobName;
  payload: T;
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
  createdAt: number;
}

type Handler<T> = (payload: T) => Promise<void>;

class InMemoryJobQueue {
  private queue: Job[] = [];
  private handlers: Map<JobName, Handler<any>> = new Map();
  private deadLetter: Job[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  register<T>(name: JobName, handler: Handler<T>) {
    this.handlers.set(name, handler as Handler<any>);
  }

  enqueue<T>(name: JobName, payload: T, opts?: { delayMs?: number; maxAttempts?: number }) {
    const job: Job = {
      id: `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      name,
      payload,
      attempts: 0,
      maxAttempts: Math.max(1, opts?.maxAttempts ?? 5),
      nextRunAt: Date.now() + (opts?.delayMs ?? 0),
      createdAt: Date.now(),
    };
    this.queue.push(job);
    this.kick();
    return job.id;
  }

  private kick() {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      try {
        const now = Date.now();
        const readyIdx = this.queue.findIndex((j) => j.nextRunAt <= now);
        if (readyIdx === -1) {
          // no ready jobs; sleep a bit
          this.timer = setTimeout(loop, 250);
          return;
        }

        const job = this.queue.splice(readyIdx, 1)[0];
        const handler = this.handlers.get(job.name);
        if (!handler) {
          // No handler—dead-letter
          this.deadLetter.push(job);
          setImmediate(loop);
          return;
        }

        try {
          await handler(job.payload);
        } catch (err) {
          job.attempts += 1;
          if (job.attempts >= job.maxAttempts) {
            this.deadLetter.push(job);
          } else {
            // exponential backoff: 0.5s, 1s, 2s, 4s, ...
            const delay = 500 * Math.pow(2, job.attempts - 1);
            job.nextRunAt = Date.now() + delay;
            this.queue.push(job);
          }
        }
        setImmediate(loop);
      } catch {
        // Safety: continue loop even if something unexpected happens
        this.timer = setTimeout(loop, 250);
      }
    };
    setImmediate(loop);
  }

  getStats() {
    return {
      queued: this.queue.length,
      deadLetter: this.deadLetter.length,
      oldestQueuedMs: this.queue.length ? Date.now() - Math.min(...this.queue.map(j => j.createdAt)) : 0,
    };
  }

  getDeadLetter(limit = 20) {
    return this.deadLetter.slice(-limit);
  }
}

let instance: InMemoryJobQueue | null = null;
export function getJobQueue() {
  if (!instance) instance = new InMemoryJobQueue();
  return instance;
}
