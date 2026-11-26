"use client";
import { useId, useState } from "react";
import { Check, IndianRupee, Sparkles, Plus, X } from "lucide-react";
import { MAX_VIBES, VIBE_NAMES, VIBE_TAGS, type Vibe } from "@backend/types/index";
export function Budget({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor="budget">
        <IndianRupee size={15} /> Budget per person (₹)
      </label>
      <input
        id="budget"
        type="number"
        inputMode="numeric"
        required
        min={1}
        max={Number.MAX_SAFE_INTEGER}
        step={1}
        placeholder="e.g. 5500"
        value={value || ""}
        onChange={(event) => onChange(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0)}
      />
    </div>
  );
}
export function Vibes({
  v,
  onChange,
}: {
  v: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const id = useId();
  const customVibes = v.filter(value => !VIBE_TAGS.includes(value as Vibe));

  function addCustom() {
    const text = custom.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().replace(/\s+/g, " ");
    if (!text) { setMessage("Enter your custom vibe, then select Add."); return; }
    const preset = VIBE_TAGS.find(tag => VIBE_NAMES[tag].toLowerCase() === text.toLowerCase());
    const value = preset ?? text;
    if (v.some(selected => selected.toLowerCase() === value.toLowerCase())) { setMessage("This vibe is already selected."); return; }
    if (v.length >= MAX_VIBES) { setMessage(`Maximum ${MAX_VIBES} vibes. Remove one before adding another.`); return; }
    onChange([...v, value]);
    setCustom("");
    setMessage("");
  }

  return (
    <fieldset className="vibes-field">
      <legend>
        <Sparkles size={15} /> Pick your vibes <small>{v.length} selected · min 1</small>
      </legend>
      <div className="chips">
        {VIBE_TAGS.map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={v.includes(t)}
            onClick={() =>
              onChange(
                v.includes(t)
                  ? v.filter((s) => s !== t)
                  : v.length < MAX_VIBES
                    ? [...v, t]
                    : v,
              )
            }
            disabled={!v.includes(t) && v.length >= MAX_VIBES}
          >
            {v.includes(t) && <Check size={14} />} {VIBE_NAMES[t]}
          </button>
        ))}
        {customVibes.map(value => <button key={value} type="button" aria-pressed="true" aria-label={`Remove ${value}`} onClick={() => onChange(v.filter(item => item !== value))}>
          <span>{value}</span><X size={14} aria-hidden="true" />
        </button>)}
      </div>
      <label htmlFor={id}>Add your own vibe</label>
      <div className="custom-vibe-entry">
        <input id={id} type="text" maxLength={40} placeholder="e.g. Beach hopping, photography" value={custom}
          onChange={event => { setCustom(event.target.value); setMessage(""); }}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} />
        <button type="button" className="linkbtn" onClick={addCustom}><Plus size={16} />Add</button>
      </div>
      <small>Choose at least one vibe. Select Add to include your custom vibe.</small>
      {message && <small role="status">{message}</small>}
    </fieldset>
  );
}
