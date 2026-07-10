// jobs/slaSweep.job.js
//
// Repeatable BullMQ job — sweeps for SLA breaches every minute. Kept as a
// scheduled sweep rather than per-ticket timers because timers don't
// survive process restarts and don't scale cleanly across multiple app
// instances; a single shared repeatable job (BullMQ guarantees only one
// worker picks up each scheduled run) is simpler and correct at 10k-user
// scale.

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis'; // BullMQ uses ioredis under the hood
import { sweepSLABreaches } from '../services/sla.service.js';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

// BullMQ requires maxRetriesPerRequest to be null when setting up the connection
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// 🆕 FIXED: Changed 'support:sla-sweep' to 'support-sla-sweep' (No colons allowed!)
export const slaSweepQueue = new Queue('support-sla-sweep', { connection });

export async function scheduleSLASweep() {
  await slaSweepQueue.add(
    'sweep',
    {},
    {
      repeat: { every: 60_000 }, // every 60s
      removeOnComplete: 100,
      removeOnFail: 100,
      jobId: 'sla-sweep-repeatable', // stable id prevents duplicate schedules on redeploy
    }
  );
}

/**
 * @param {import('socket.io').Server} io  passed in at worker-startup time
 * so breach notifications can push realtime, not just via the DB record.
 */
export function startSLASweepWorker(io) {
  const worker = new Worker(
    'support-sla-sweep', // 🆕 FIXED: Must match the Queue name exactly
    async () => {
      const result = await sweepSLABreaches({ io });
      return result;
    },
    { connection, concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    console.error('[slaSweep.job] job failed:', job?.id, err.message);
  });

  return worker;
}