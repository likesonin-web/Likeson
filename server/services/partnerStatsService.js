import mongoose from "mongoose";
import DoctorProfile from "../models/DoctorProfile.js";
import Driver from "../models/Driver.js";
import SoloDriverPartner from "../models/SoloDriverPartner.js";
import TransportPartner from "../models/TransportPartner.js";
import CareAssistantProfile from "../models/CareAssistantProfile.js";
import LabPartnerProfile from "../models/LabPartnerProfile.js";

/**
 * incrementCompletionStats — bump counters on the partner(s) attached to a
 * booking the moment it hits status:'completed'. Money stays in
 * allocationEngine.service.js; this is display/analytics counters only.
 */
export async function incrementCompletionStats(booking) {
  const jobs = [];

  if (booking.doctor) {
    jobs.push(DoctorProfile.findByIdAndUpdate(booking.doctor, {
      $inc: { "stats.totalConsultations": 1 },
      $set: { "stats.lastConsultationAt": new Date() },
    }));
  }
  if (booking.careAssistant) {
    jobs.push(CareAssistantProfile.findByIdAndUpdate(booking.careAssistant, {
      $inc: { "performance.totalTasksCompleted": 1, "earnings.lifetimeBookings": 1 },
      $set: { "performance.lastTaskAt": new Date() },
    }));
  }
  if (booking.driver) {
    jobs.push(Driver.findByIdAndUpdate(booking.driver, {
      $inc: { "performance.totalRidesCompleted": 1, "performance.monthlyRides": 1 },
      $set: { "performance.lastRideAt": new Date() },
    }));
  }
  if (booking.solodriverpartner) {
    jobs.push(SoloDriverPartner.findByIdAndUpdate(booking.solodriverpartner, {
      $inc: { "stats.totalRidesCompleted": 1 },
      $set: { "stats.lastRideAt": new Date() },
    }));
  }
  if (booking.transportPartner) {
    jobs.push(TransportPartner.findByIdAndUpdate(booking.transportPartner, {
      $inc: { "stats.totalRidesCompleted": 1 },
      $set: { "stats.lastRideAt": new Date() },
    }));
  }
  if (booking.diagnosticDetails?.labPartner) {
    jobs.push(LabPartnerProfile.findByIdAndUpdate(booking.diagnosticDetails.labPartner, {
      $inc: { "stats.totalBookingsCompleted": 1 },
    }).catch(() => {})); // field optional — no-op if schema lacks it
  }

  const results = await Promise.allSettled(jobs);
  results.forEach(r => { if (r.status === "rejected") console.error("[incrementCompletionStats]", r.reason?.message); });
}

const bumpAvg = (avg = 0, total = 0, newVal) => {
  const t = total + 1;
  return { averageRating: +(((avg * total) + newVal) / t).toFixed(2), totalRatings: t };
};

/**
 * applyBookingRating — pushes booking.rating fields into each partner's own
 * rating aggregate (+ a review subdoc for labs). Called once after
 * booking.rating is set/saved in the /rate route. Read-then-write (not
 * atomic) — acceptable here, matches existing averageRating patterns
 * elsewhere in the codebase (e.g. LabPartnerProfile pre-save review recalc).
 */
export async function applyBookingRating(booking) {
  const r = booking.rating;
  if (!r) return;

  try {
    if (r.doctorRating && booking.doctor) {
      const doc = await DoctorProfile.findById(booking.doctor).select("rating").lean();
      const next = bumpAvg(doc?.rating?.averageRating, doc?.rating?.totalRatings, r.doctorRating);
      await DoctorProfile.findByIdAndUpdate(booking.doctor, {
        $set: { "rating.averageRating": next.averageRating, "rating.totalRatings": next.totalRatings },
        $inc: { "rating.totalReviews": r.doctorComment ? 1 : 0 },
      });
    }

    if (r.careAssistantRating && booking.careAssistant) {
      const ca = await CareAssistantProfile.findById(booking.careAssistant).select("performance").lean();
      const next = bumpAvg(ca?.performance?.averageRating, ca?.performance?.totalRatings, r.careAssistantRating);
      await CareAssistantProfile.findByIdAndUpdate(booking.careAssistant, {
        $set: { "performance.averageRating": next.averageRating, "performance.totalRatings": next.totalRatings },
        $inc: r.careAssistantComment ? { "performance.complimentsCount": r.careAssistantRating >= 4 ? 1 : 0, "performance.complaintsCount": r.careAssistantRating <= 2 ? 1 : 0 } : {},
      });
    }

    if (r.driverRating && booking.driver) {
      const d = await Driver.findById(booking.driver).select("performance").lean();
      const next = bumpAvg(d?.performance?.rating, d?.performance?.ratingCount, r.driverRating);
      await Driver.findByIdAndUpdate(booking.driver, {
        $set: { "performance.rating": next.averageRating, "performance.ratingCount": next.totalRatings },
      });
    }
    if (r.driverRating && booking.solodriverpartner) {
      const sp = await SoloDriverPartner.findById(booking.solodriverpartner).select("rating").lean();
      const next = bumpAvg(sp?.rating?.averageRating, sp?.rating?.totalRatings, r.driverRating);
      await SoloDriverPartner.findByIdAndUpdate(booking.solodriverpartner, {
        $set: { "rating.averageRating": next.averageRating, "rating.totalRatings": next.totalRatings },
      });
    }

    if (r.labRating && booking.diagnosticDetails?.labPartner) {
      await LabPartnerProfile.findByIdAndUpdate(booking.diagnosticDetails.labPartner, {
        $push: { reviews: { user: booking.customer, rating: r.labRating, comment: r.labComment || "", isVisible: true } },
      });
      const lab = await LabPartnerProfile.findById(booking.diagnosticDetails.labPartner).select("reviews").lean();
      const visible = (lab?.reviews || []).filter(v => v.isVisible);
      const avg = visible.length ? +(visible.reduce((s, v) => s + v.rating, 0) / visible.length).toFixed(2) : 0;
      await LabPartnerProfile.findByIdAndUpdate(booking.diagnosticDetails.labPartner, {
        $set: { averageRating: avg, totalReviews: visible.length },
      });
    }

    if (r.overallRating && booking.hospital) {
      const Hospital = mongoose.model("Hospital");
      const h = await Hospital.findById(booking.hospital).select("rating").lean();
      const next = bumpAvg(h?.rating?.averageRating, h?.rating?.totalRatings, r.overallRating);
      await Hospital.findByIdAndUpdate(booking.hospital, {
        $set: { "rating.averageRating": next.averageRating, "rating.totalRatings": next.totalRatings },
        $inc: { "rating.totalReviews": r.overallComment ? 1 : 0 },
      });
    }
  } catch (err) {
    console.error("[applyBookingRating] failed:", err.message);
  }
}