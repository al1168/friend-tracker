// The reminders Worker. It has no URL (workers_dev is off and there are no routes): the Pages
// project reaches it only through its REMINDERS service binding, and calls these RPC methods.
// Every call goes to the one schedule, the Durable Object named "owner".

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'
import { pushSender, type VapidEnv } from './push.ts'
import { Schedule, type SyncInput, type TestResult } from './schedule.ts'

export interface Env extends VapidEnv {
  SCHEDULE: DurableObjectNamespace<ReminderSchedule>
}

/** One schedule, kept in Durable Object storage and woken by its alarm. */
export class ReminderSchedule extends DurableObject<Env> {
  private readonly schedule: Schedule

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.schedule = new Schedule(ctx.storage, pushSender(env), () => Date.now())
  }

  async sync(input: SyncInput): Promise<void> {
    await this.schedule.sync(input)
  }

  async clear(): Promise<void> {
    await this.schedule.clear()
  }

  async sendTest(): Promise<TestResult> {
    return this.schedule.sendTest()
  }

  async alarm(): Promise<void> {
    await this.schedule.alarm()
  }
}

function owner(env: Env) {
  return env.SCHEDULE.get(env.SCHEDULE.idFromName('owner'))
}

export default class RemindersWorker extends WorkerEntrypoint<Env> {
  async sync(input: SyncInput): Promise<void> {
    await owner(this.env).sync(input)
  }

  async clear(): Promise<void> {
    await owner(this.env).clear()
  }

  // Not named "test": that's the name of a Workers handler, so it can't be an RPC method.
  async sendTest(): Promise<TestResult> {
    return owner(this.env).sendTest()
  }
}
