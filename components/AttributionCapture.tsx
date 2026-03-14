"use client";

import { useEffect } from "react";
import { persistAttributionFromWindow } from "@/lib/attribution";

export default function AttributionCapture() {
  useEffect(() => {
    persistAttributionFromWindow();
  }, []);

  return null;
}
