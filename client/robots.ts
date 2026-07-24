import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_FORNTEND_URL || "https://likeson.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/super-admin",
        "/doctor",
        "/driver",
        "/pharmacy",
        "/pharmacy-store",
        "/hospital-manager",
        "/lab-partner",
        "/labs",
        "/care-assistant",
        "/transport-partner",
        "/partner",
        "/dashboard",
        "/myaccount",
        "/profile",
        "/settings",
        "/wallet",
        "/notifications",
        "/my-bookings",
        "/my-consultations",
        "/my-reports",
        "/my-referral",
        "/my-subscription",
        "/rides",
        "/auth-success",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
