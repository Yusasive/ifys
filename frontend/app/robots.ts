import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://ifysummit.com";

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/checkin", "/unsubscribe"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
