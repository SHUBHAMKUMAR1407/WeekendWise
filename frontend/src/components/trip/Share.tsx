"use client";
import { useRef, useState } from "react";
import { Share2, Download } from "lucide-react";
import { track } from "@frontend/lib/client";
export function Copy({
  value,
  label = "Copy",
  onSuccess,
}: {
  value: string;
  label?: string;
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState(""),
    [fallback, setFallback] = useState(false),
    ref = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied");
      onSuccess?.();
    } catch {
      setFallback(true);
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.select();
      });
      setStatus("Select the text and tap Copy.");
    }
  }
  return (
    <div>
      <button type="button" className="linkbtn" onClick={copy}>
        <CopyIcon />
        {label}
      </button>
      {status && (
        <small className="block" role="status">
          {status}
        </small>
      )}
      {fallback && (
        <textarea
          aria-label="Text to copy"
          readOnly
          ref={ref}
          value={value}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </svg>
  );
}
export function ShareLink({ id }: { id: string }) {
  const [fallback, setFallback] = useState("");
  async function share() {
    const url = location.origin + "/trip/" + id;
    try {
      if (!navigator.share) {
        setFallback(url);
        return;
      }
      await navigator.share({
        title: "WeekendWise Weekend plan",
        text: "Vote for your trip preferences!",
        url,
      });
      track("link_shared", id);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFallback(url);
    }
  }
  return (
    <div className="stack">
      <button type="button" className="linkbtn" onClick={share}>
        <Share2 size={17} /> Invite friends
      </button>
      {fallback && (
        <div>
          <label>
            Trip link
            <input
              readOnly
              value={fallback}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Copy
            label="Copy trip link"
            value={fallback}
            onSuccess={() => track("link_shared", id)}
          />
        </div>
      )}
    </div>
  );
}
export function ShareCard({
  id,
  kind,
  url,
}: {
  id: string;
  kind: "parent" | "trip";
  url: string;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url);
      if (!r.ok) throw Error();
      const blob = await r.blob();
      if (!blob.type.includes("image/png")) throw Error();
      setFile(
        new File([blob], "weekendwise-" + kind + ".png", { type: "image/png" }),
      );
      track("card_generated", id, { kind });
    } catch {
      setError("Image could not load. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: "WeekendWise" });
      track("card_shared", id, { kind });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("Use Download PNG to save your card.");
    }
  }
  const canShare =
    !!file &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  return (
    <div className="stack">
      {!file ? (
        <button
          type="button"
          className="linkbtn"
          disabled={busy}
          onClick={generate}
        >
          <Share2 size={16} />
          {busy
            ? "Preparing PNG…"
            : kind === "trip"
              ? "Make share card"
              : "Make Parent Brief PNG"}
        </button>
      ) : (
        <div className="panel-actions">
          {canShare && (
            <button type="button" className="linkbtn" onClick={share}>
              <Share2 size={16} />
              Share card
            </button>
          )}
          <a
            className="linkbtn"
            href={url + (url.includes("?") ? "&" : "?") + "download=1"}
            download={"weekendwise-" + kind + ".png"}
          >
            <Download size={16} />
            Download PNG
          </a>
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
