"use client";
import { useId, useState, type FormEvent } from "react";
import useSWR from "swr";
import { MapPin, TrendingUp, Users } from "lucide-react";
import { identity, json } from "@frontend/lib/client";
import { formatDates, todayIST } from "@backend/utils/dates";
import type { CrowdInsights as Insights, CrowdObservation } from "@backend/types/crowd";
import { CROWD_OPTIONS } from "@backend/types/updates";

export default function CrowdInsights({ destinationId, destinationName, tripDates }: {
  destinationId: string; destinationName: string; tripDates?: { startDate: string; endDate: string };
}) {
  const uid = useId(), dates = tripDates ?? { startDate: todayIST(), endDate: todayIST() };
  const endpoint = "/api/crowd/" + encodeURIComponent(destinationId);
  const url = endpoint + "?" + new URLSearchParams(dates);
  const { data, error, mutate, isValidating } = useSWR<Insights>(url, () => json<Insights>(url), { refreshInterval: 60000 });
  const [selected, setSelected] = useState(4), [checkinOpen, setCheckinOpen] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [submitError, setSubmitError] = useState("");
  const [interestSaved, setInterestSaved] = useState(false);
  const day = data?.days[selected];
  async function interest(interested: boolean) {
    setBusy(true); setSubmitError(""); setMessage("");
    try {
      await json(endpoint, { kind: "interest", anonId: identity().anonId, interested, ...dates });
      setInterestSaved(interested);
      setMessage(interested ? "Your interest is counted for these dates. It is not a booking or an arrival." : "Your planning interest was removed.");
      await mutate();
    } catch (e) { setSubmitError(e instanceof Error ? e.message : "Could not save your interest."); }
    finally { setBusy(false); }
  }
  async function checkin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (fields.get("consent") !== "on") return;
    setBusy(true); setSubmitError(""); setMessage("");
    try {
      if (!navigator.geolocation) throw new Error("Location is unavailable in this browser. You can share a visit report below.");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Location could not be obtained. Allow location access or share a visit report below.")),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      if (position.coords.accuracy > 2000) throw new Error("Your location is too approximate. Try outdoors or share a visit report below.");
      await json(endpoint, { kind: "checkin", anonId: identity().anonId, consent: true,
        crowd: fields.get("crowd") as CrowdObservation, latitude: position.coords.latitude,
        longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp });
      setMessage("Checked in for today. Another check-in updates your observation instead of adding a visitor.");
      setCheckinOpen(false); setSelected(4); await mutate();
    } catch (e) { setSubmitError(e instanceof Error ? e.message : "Could not check in."); }
    finally { setBusy(false); }
  }
  return <section className="subpanel stack crowd-insights" aria-labelledby={uid + "-title"}>
    <div className="updates-heading">
      <div className="stack"><span className="tiny lime inline"><TrendingUp size={16} aria-hidden="true" /> COMMUNITY CROWD SIGNALS</span>
        <h3 id={uid + "-title"}>How busy has {destinationName} been?</h3>
        <p>Last five days, including today · IST. Select a day to inspect its evidence.</p></div>
      <span className="chip">{data?.direction ?? "Awaiting observations"}</span>
    </div>
    {error ? <div className="stack"><p role="alert">Crowd history could not load. {tripDates ? "The seasonal estimate above is still available." : "Please retry shortly."}</p>
      <button className="secondary" disabled={isValidating} onClick={() => mutate()}>Retry crowd history</button></div>
      : !data ? <p role="status">Loading crowd history…</p> : <>
        <div className="crowd-trend" role="group" aria-label="Five-day reported crowd levels, from 1 to 5">
          {data.days.map((point, index) => <button key={point.date} className="crowd-trend-day" aria-pressed={selected === index}
            onClick={() => setSelected(index)} aria-label={`${formatDates(point.date, point.date)}: ${point.label}${point.level === null ? "" : `, ${point.level} out of 5`}, ${point.samples} observations, ${point.confidence.toLowerCase()} evidence`}>
            <strong>{point.level === null ? "—" : point.level + "/5"}</strong>
            <span className="crowd-bar-track" aria-hidden="true"><span className={point.level === null ? "crowd-bar-empty" : "crowd-bar"}
              style={{ height: point.level === null ? "5px" : (point.level / 5 * 100) + "%" }} /></span>
            <span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(point.date + "T12:00:00Z"))}</span>
            <small>{point.samples} {point.samples === 1 ? "report" : "reports"}</small>
          </button>)}
        </div>
        {day && <div className="crowd-evidence stack" aria-live="polite">
          <div className="row"><strong>{formatDates(day.date, day.date)} · {day.label}</strong><span className="chip">{day.confidence} evidence</span></div>
          <p>{day.samples} unique browser observations: {day.checkins} location check-ins and {day.reports} other visit reports.</p>
          {day.level === null && <small>At least 3 independent browser observations per day are needed to display a crowd level. No reports does not mean an empty destination.</small>}
        </div>}
        <small>Score: quiet 1, moderate 2, busy 4, very crowded 5; average of the latest observation per browser and visit day. Reports and check-ins from the same browser count once. Evidence is insufficient below 3 samples, limited at 3–9, and moderate at 10 or more; this describes sample size, not verified accuracy. Today is partial; direction compares today with yesterday only when both have enough reports.</small>
        <div className="crowd-planning stack">
          <strong className="inline"><Users size={17} aria-hidden="true" /> {data.planning} {data.planning === 1 ? "browser is" : "browsers are"} planning overlapping dates</strong>
          <p>{formatDates(dates.startDate, dates.endDate)} · Interest from WeekendWise users, not visitor counts or bookings.</p>
          <div className="panel-actions"><button className="secondary" disabled={busy} onClick={() => interest(true)}>{interestSaved ? "Update my trip interest" : "I’m planning a visit"}</button>
            <button className="secondary" disabled={busy} onClick={() => interest(false)}>Remove my interest</button></div>
        </div>
        <small>Updated {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(data.updatedAt))} IST. These are samples from our users, not live footfall or a prediction for future dates.</small>
      </>}
    <div className="panel-actions"><button className="secondary inline" disabled={busy} aria-expanded={checkinOpen} aria-controls={uid + "-checkin"}
      onClick={() => { setCheckinOpen(!checkinOpen); setSubmitError(""); }}><MapPin size={16} aria-hidden="true" /> {checkinOpen ? "Close check-in" : "I’m here · Check in"}</button></div>
    {checkinOpen && <form id={uid + "-checkin"} className="stack updates-form" onSubmit={checkin}>
      <h4>What’s the crowd like right now?</h4>
      <label className="field">Crowd near you<select name="crowd" required defaultValue=""><option value="" disabled>Choose a crowd level</option>
        {Object.entries(CROWD_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p>Check-ins cover a 25 km area around {destinationName}’s listed location. We check that your browser location is within this area; this does not independently verify attendance or represent every neighbourhood.</p>
      <label className="visit-confirm"><input name="consent" type="checkbox" required />I agree to send my current location to verify proximity and publish my anonymous crowd observation for today. Coordinates are discarded after the check; only the destination, day and observation are saved.</label>
      <small>Your browser will ask for location permission after you select “Use location & check in”. You can use the site without checking in.</small>
      <button className="primary" disabled={busy} type="submit">{busy ? "Checking location…" : "Use location & check in"}</button>
    </form>}
    {submitError && <p role="alert">{submitError}</p>}
    {message && <p className="lime" role="status">{message}</p>}
  </section>;
}
