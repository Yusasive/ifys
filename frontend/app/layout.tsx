import type { Metadata } from "next";
import { Inter, Newsreader, Space_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store-provider";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
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

export const metadata: Metadata = {
  title: "Islamic Finance Youth Summit 2026",
  description: "Registration & ticketing for the Islamic Finance Youth Summit 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
