"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { resolveOrigin, suggestOrigins } from "@frontend/lib/origin";

export default function OriginInput({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [search, setSearch] = useState<{query:string; items:string[]; status:"loading"|"ready"|"error"; error?:string} | null>(null);
  const current = search?.query === value ? search : null;
  const suggestions = current?.status === "ready" ? current.items : suggestOrigins(value);
  const city = resolveOrigin(value);
  const expanded = open && suggestions.length > 0;

  useEffect(() => {
    if (!open || value.trim().length < 2) return;
    const controller = new AbortController();
    setSearch({ query: value, items: [], status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/places/autocomplete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: value.trim() }), signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Address search is unavailable.");
        if (!Array.isArray(data.suggestions) || data.suggestions.some((item:unknown) => typeof item !== "string")) throw new Error("Address search is unavailable.");
        if (!controller.signal.aborted) { setSearch({ query: value, items: data.suggestions, status: "ready" }); setActive(-1); }
      } catch (error) {
        if (!controller.signal.aborted) setSearch({ query: value, items: [], status: "error", error: error instanceof Error ? error.message : "Address search is unavailable." });
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, open]);

  function select(address: string) {
    setSearch(current?.status === "ready" ? { query: address, items: [], status: "ready" } : null);
    onChange(address);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="field origin-field" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label htmlFor="city"><MapPin size={15} />Starting address / city</label>
      <div className="origin-control">
        <input
          id="city"
          type="text"
          role="combobox"
          required
          maxLength={160}
          autoComplete="off"
          placeholder="e.g. Andheri, Mumbai"
          aria-describedby="origin-help"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls="origin-suggestions"
          aria-activedescendant={expanded && active >= 0 ? `origin-option-${active}` : undefined}
          value={value}
          onFocus={() => { setOpen(true); setActive(-1); }}
          onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={event => {
            if (event.key === "Escape") { setOpen(false); setActive(-1); }
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
              event.preventDefault();
              setOpen(true);
              setActive(event.key === "ArrowDown" ? (active + 1) % suggestions.length : (active <= 0 ? suggestions.length : active) - 1);
            }
            if (event.key === "Enter" && expanded && active >= 0) {
              event.preventDefault();
              select(suggestions[active]);
            }
          }}
        />
        {expanded && <div className="origin-suggestions">
          <div id="origin-suggestions" role="listbox" aria-label="Suggested starting areas and cities">
          {suggestions.map((address, index) => <button
            key={address}
            id={`origin-option-${index}`}
            type="button"
            role="option"
            aria-selected={active === index}
            tabIndex={-1}
            onMouseDown={event => event.preventDefault()}
            onClick={() => select(address)}
          ><MapPin size={15} aria-hidden="true" /><span>{address}</span></button>)}
          </div>
          {current?.status === "ready" && <div className="maps-attribution" translate="no">Google Maps</div>}
        </div>}
      </div>
      <small id="origin-help" aria-live="polite">
        {open && current?.status === "loading" ? "Searching for addresses…" : open && current?.status === "error" ? current.error
          : city ? `Trips from ${city}. Estimates start from the city.` : !open && current?.status === "ready" && value.trim()
          ? "Travel routes from this location are not available yet. Choose a supported departure city."
          : open && value.trim() && !suggestions.length
          ? "No matching address found. Try adding the city and state."
          : "Enter an area or city, then choose a suggestion."}
      </small>
      <small className="origin-provider-note">Your search text is sent to Google Maps for address suggestions. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></small>
    </div>
  );
}
