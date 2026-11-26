"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Users,
  User,
  Ticket,
} from "lucide-react";
import { Budget, Vibes } from "../forms/Fields";
import OriginInput from "../forms/OriginInput";
import {
  type Room,
} from "@backend/types/index";
import { weekend, todayIST, formatDates } from "@backend/utils/dates";
import { identity, json } from "@frontend/lib/client";
import { resolveOrigin } from "@frontend/lib/origin";
export default function Landing({
  initial,
}: {
  initial: { startDate: string; endDate: string };
}) {
  const router = useRouter(),
    [address, setAddress] = useState(""),
    [budget, setBudget] = useState(4500),
    [mode, setMode] = useState<"group" | "solo">("group"),
    [when, setWhen] = useState("this"),
    [dates, setDates] = useState(initial),
    [vibes, setVibes] = useState<string[]>([]),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const city = resolveOrigin(address);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!city) {
      setError("Include one supported starting city in your address: Delhi NCR, Mumbai, Pune, Bengaluru, Hyderabad, Chandigarh, Kolkata, Chennai, Ahmedabad or Jaipur.");
      return;
    }
    if (mode === "solo" && vibes.length < 1) {
      setError("Choose at least one vibe for your weekend.");
      return;
    }
    setBusy(true);
    try {
      const r = await json<Room>("/api/rooms", {
        ...identity(),
        startCity: city,
        maxBudgetPerPerson: budget,
        mode,
        ...(when === "pick"
          ? dates
          : weekend(when === "this" ? "this" : "next")),
        ...(mode === "solo"
          ? { solo: { name: name.trim(), vibes } }
          : {}),
      });
      router.push("/trip/" + r.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="planner" id="planner">
      <div className="ticket-head">
        <span className="ticket-icon">
          <Ticket size={22} />
        </span>
        <span className="tiny">TRIP PLANNER</span>
        <span className="barcode" aria-hidden="true" />
      </div>
      <div className="ticket-body">
        <h2>Set your weekend.</h2>
        <OriginInput value={address} onChange={setAddress} />
        <Budget value={budget} onChange={setBudget} />
        <fieldset>
          <legend>
            <CalendarDays size={15} />
            Trip dates
          </legend>
          <div className="seg dates">
            {[
              ["this", "This weekend"],
              ["next", "Next weekend"],
              ["pick", "Pick dates"],
            ].map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={when === k}
                onClick={() => {
                  setWhen(k);
                  if (k !== "pick")
                    setDates(weekend(k === "this" ? "this" : "next"));
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {when === "pick" ? (
            <div className="date-pair">
              {(["startDate", "endDate"] as const).map((k, i) => (
                <label key={k}>
                  {i ? "Return" : "Leave"}
                  <input
                    type="date"
                    required
                    min={i ? dates.startDate : todayIST()}
                    value={dates[k]}
                    onChange={(e) =>
                      setDates({ ...dates, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          ) : (
            <small className="dates-note">
              {formatDates(dates.startDate, dates.endDate)}
            </small>
          )}
        </fieldset>
        <fieldset>
          <legend>
            <Users size={15} />
            Who's coming?
          </legend>
          <div className="seg mode">
            {(["solo", "group"] as const).map((k) => (
              <button
                key={k}
                aria-pressed={mode === k}
                type="button"
                onClick={() => setMode(k)}
              >
                {k === "solo" ? <User size={15} /> : <Users size={16} />}{" "}
                {k === "solo" ? "Solo" : "With friends"}
                {mode === k && <Check size={13} />}
              </button>
            ))}
          </div>
        </fieldset>
        {mode === "solo" && (
          <>
            <label>
              Full name
              <input
                value={name}
                required
                autoComplete="name"
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Vibes v={vibes} onChange={setVibes} />
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Creating your trip…"
            : mode === "group"
              ? "Create Trip Link"
              : "Plan my trip"}
          <ArrowRight size={20} />
        </button>
      </div>
      <div className="ticket-stub tiny">
        <span className="live-dot" /> FREE TO USE <span> / </span> ZERO LOGIN
      </div>
    </form>
  );
}
