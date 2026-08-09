"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MediaStorageTarget } from "@/lib/types";

export const LOCAL_SOURCE = "local";

// Dùng chung cho media-picker-modal.tsx + admin/media-library/page.tsx — 2 nơi cần y hệt tab
// Local/R2/S3 (GET /media/storage-targets, chỉ trả Provider R2/S3 đang isDefault + đã cấu hình
// publicBaseUrl). Mặc định chọn R2 nếu có (khớp "R2 mặc định"), không thì Local.
export function useMediaStorageTargets() {
  const [targets, setTargets] = useState<MediaStorageTarget[]>([]);
  const [activeSource, setActiveSource] = useState<string>(LOCAL_SOURCE);

  useEffect(() => {
    apiFetch<MediaStorageTarget[]>("/media/storage-targets")
      .then((res) => {
        setTargets(res);
        const r2 = res.find((t) => t.type === "R2");
        if (r2) setActiveSource(r2.id);
      })
      .catch(() => setTargets([]));
  }, []);

  return { targets, activeSource, setActiveSource };
}
