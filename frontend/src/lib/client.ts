import type { EventName } from "@backend/types/index";
let fallback = "";
let excluded = false;
export function identity() {
  let anonId = fallback;
  const params = new URLSearchParams(location.search);
  let source = params.get("utm_source") || undefined;
  try {
    if (params.get("internal") === "1") localStorage.setItem("internal", "1");
    excluded = localStorage.getItem("internal") === "1";
    anonId = localStorage.getItem("chalein_id") || anonId;
    if (source && /^[\w.-]{1,64}$/.test(source))
      sessionStorage.setItem("chalein_source", source);
    source = sessionStorage.getItem("chalein_source") || undefined;
  } catch {
    excluded ||= params.get("internal") === "1";
  }
  if (!anonId) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const s = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    anonId = [
      s.slice(0, 8),
      s.slice(8, 12),
      s.slice(12, 16),
      s.slice(16, 20),
      s.slice(20),
    ].join("-");
    fallback = anonId;
    try {
      localStorage.setItem("chalein_id", anonId);
    } catch {}
  }
  return {
    anonId,
    internal: excluded,
    source: source && /^[\w.-]{1,64}$/.test(source) ? source : undefined,
  };
}
export function track(
  name: EventName,
  roomId?: string,
  meta?: Record<string, string>,
) {
  try {
    const id = identity();
    if (id.internal) return;
    const data = JSON.stringify({ ...id, name, roomId, ts: Date.now(), meta });
    if (
      navigator.sendBeacon?.(
        "/api/events",
        new Blob([data], { type: "application/json" }),
      )
    )
      return;
    void fetch("/api/events", {
      method: "POST",
      body: data,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
export async function json<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  if (!r.ok) {
    const v = await r.json().catch(() => null);
    throw new Error(v?.error || "Network issue. Please try again.");
  }
  return r.json();
}
