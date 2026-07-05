/**
 * joinPointWatchdog.js — Likeson.in
 *
 * Spec: "Driver waits for the configured waiting period. If still
 * unavailable, driver continues. If another Join Point exists later,
 * attempt another join. Otherwise, Care Assistant may travel directly
 * to the hospital."
 *
 * Previously MISSED only fired on manual CA/driver socket action —
 * nothing enforced the wait period itself. This cron closes that gap.
 * Run every 30s from your job scheduler (node-cron / bull repeatable / etc).
 */

import JoinPoint from '../models/JoinPoint.js';
import RideStop from '../models/RideStop.js';
import RideParticipant from '../models/RideParticipant.js';
import RideTracking from '../models/RideTracking.js';
import Ride from '../models/Ride.js';
import { createNotification } from '../routes/bookingRouterShared.js';
import { getBookingSocketService } from './bookingSocketService.js';

const DEFAULT_WAIT_MS = 10 * 60 * 1000; // fallback if JoinPoint.waitingConfig.maxWaitMinutes unset

export async function runJoinPointWatchdog() {
  const now = Date.now();

  // Only LOCKED, active, not-yet-arrived join points can go stale.
  const candidates = await JoinPoint.find({
    status: 'LOCKED',
    isActive: true,
  }).lean();

  for (const jp of candidates) {
    const waitMs = (jp.waitingConfig?.maxWaitMinutes ?? 10) * 60 * 1000 || DEFAULT_WAIT_MS;
    const anchor = jp.lockedAt ? new Date(jp.lockedAt).getTime() : new Date(jp.createdAt).getTime();
    if (now - anchor < waitMs) continue; // still within wait window

    try {
      await JoinPoint.findByIdAndUpdate(jp._id, {
        $set: { status: 'MISSED', missedAt: new Date() },
      });

      await RideStop.findOneAndUpdate(
        { ride: jp.ride, stopType: 'CARE_ASSISTANT_JOIN', status: { $in: ['PENDING', 'ARRIVED'] }, isActive: true },
        { $set: { status: 'MISSED' } },
      );

      await RideParticipant.findByIdAndUpdate(jp.participant, { $set: { status: 'PENDING' } });

      const ride = await Ride.findById(jp.ride).select('booking currentStopId').lean();

      // Driver continues: advance currentStopId past the missed CA stop to
      // whatever's PENDING next (patient pickup / hospital), so the driver
      // isn't stuck waiting on a stop nobody will complete.
      const nextStop = await RideStop.findOne({
        ride: jp.ride, isActive: true, status: 'PENDING',
      }).sort({ sequence: 1 }).lean();
      if (nextStop && ride) {
        await Ride.findByIdAndUpdate(jp.ride, { $set: { currentStopId: nextStop._id } });
        await RideTracking.findOneAndUpdate({ ride: jp.ride }, { $set: { currentStopId: nextStop._id } });
      }

      if (ride?.booking) {
        getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'ca_missed_joinpoint', {
          bookingId: ride.booking, rideId: jp.ride, joinPointId: jp._id,
          reason: 'auto_wait_period_expired', timestamp: new Date(),
        });
        getBookingSocketService()?.emitToAdminOps('join_point_missed', {
          bookingId: String(ride.booking), rideId: String(jp.ride), jpId: String(jp._id),
          participantId: jp.participant, attemptNumber: jp.attemptNumber,
          note: 'Auto-missed after wait period — recalculate join point or direct CA to hospital',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('[joinPointWatchdog] failed for JP', jp._id, err.message);
    }
  }
}

// Wire this into your scheduler, e.g.:
//   import cron from 'node-cron';
//   cron.schedule('*/30 * * * * *', () => runJoinPointWatchdog().catch(console.error));