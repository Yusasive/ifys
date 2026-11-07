import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter, Newsreader, Space_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store-provider";
import { AttributionCapture } from "./attribution-capture";
import { WhatsAppButton } from "./whatsapp-button";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  // Variable font (opsz/wght axes): naming weights makes Turbopack request
  // several files per face and fail ("queries have exactly one entry").
  // Omitted, one variable file per style covers every weight.
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  // Variable font (opsz/wdth/wght axes): naming weights makes Turbopack's
  // production build request several files per face and fail. Omitted, one
  // variable file covers every weight.
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const title = "Islamic Finance Youth Summit 2026";
const description =
  "Registration & ticketing for the Islamic Finance Youth Summit 2026";
const siteUrl = "https://ifysummit.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    images: [{ url: "/hero.png", width: 1200, height: 630, alt: title }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/hero.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${spaceMono.variable} ${bricolageGrotesque.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper">
        <StoreProvider>{children}</StoreProvider>
        <AttributionCapture />
        <WhatsAppButton />
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "48d35a37c6ef4760a770fac4833c300b"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
