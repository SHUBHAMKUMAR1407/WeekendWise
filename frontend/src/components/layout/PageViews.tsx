"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@frontend/lib/client";
export default function PageViews() {
  const path = usePathname(),
    last = useRef("");
  useEffect(() => {
    if (path !== last.current && !path.startsWith("/stats")) {
      last.current = path;
      track("page_view", path.match(/^\/trip\/([\w-]{10})/)?.[1]);
    }
  }, [path]);
  return null;
}
