import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // The "scan for agenda" QR on printed name tags points here — serve
      // it as a download with a readable filename rather than a bare
      // "agenda.pdf" tab.
      {
        source: "/agenda.pdf",
        headers: [
          {
            key: "Content-Disposition",
            value: 'attachment; filename="IFY_Summit_2026_Agenda.pdf"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
