import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
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
