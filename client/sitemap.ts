import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_FORNTEND_URL || "https://likeson.in";

// Only genuinely public, unauthenticated marketing/informational routes belong here.
// Account-gated pages (dashboard, wallet, my-bookings, role dashboards, etc.) are
// intentionally excluded — they carry no SEO value and shouldn't be crawled.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "",                   priority: 1.0, changeFrequency: "daily" },
  { path: "/about",             priority: 0.7, changeFrequency: "monthly" },
  { path: "/how-it-works",      priority: 0.7, changeFrequency: "monthly" },
  { path: "/services",          priority: 0.8, changeFrequency: "weekly" },
  { path: "/consultation",      priority: 0.8, changeFrequency: "weekly" },
  { path: "/book-appointment",  priority: 0.8, changeFrequency: "weekly" },
  { path: "/request-ride",      priority: 0.7, changeFrequency: "weekly" },
  { path: "/blood-bank",        priority: 0.6, changeFrequency: "weekly" },
  { path: "/subscriptions",     priority: 0.6, changeFrequency: "monthly" },
  { path: "/search",            priority: 0.5, changeFrequency: "weekly" },
  { path: "/support",           priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms",             priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy",           priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
