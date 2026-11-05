"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

// Renders nothing; records where the visitor came from on their first page.
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
