"use client";
import { useId, useState, type FormEvent } from "react";
import useSWR from "swr";
import { CloudSun, MessageSquare, Users } from "lucide-react";
import { identity, json } from "@frontend/lib/client";
import { addDays, todayIST } from "@backend/utils/dates";
import { CROWD_OPTIONS, EXPERIENCE_OPTIONS, WEATHER_OPTIONS, type TravellerUpdate, type TravellerUpdates as Updates } from "@backend/types/updates";

const dateLabel = (day: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
}).format(new Date(day + "T12:00:00Z"));
function common<T extends string>(counts: Partial<Record<T, number>>, labels: Record<T, string>) {
  const sorted = Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]));
  if (!sorted.length) return "No reports yet";
  if (sorted[1] && sorted[0][1] === sorted[1][1]) return "Mixed reports";
  return labels[sorted[0][0] as T];
}
export default function TravellerUpdates({ destinationId, destinationName }: { destinationId: string; destinationName: string }) {
  const uid = useId();
  const url = "/api/updates/" + encodeURIComponent(destinationId);
  const { data, error, mutate, isValidating } = useSWR<Updates>(url, () => json<Updates>(url), { refreshInterval: 60000 });
  const [formOpen, setFormOpen] = useState(false), [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState(false), [submitError, setSubmitError] = useState(""), [success, setSuccess] = useState("");
  const today = todayIST();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    setPending(true); setSubmitError(""); setSuccess("");
    try {
      await json<TravellerUpdate>(url, {
        anonId: identity().anonId, name: String(fields.get("name") || ""),
        visitedOn: fields.get("visitedOn"), weather: fields.get("weather"), crowd: fields.get("crowd"),
        experience: fields.get("experience"), note: String(fields.get("note") || ""), visited: fields.get("visited") === "on",
      });
      setSuccess("Your update is published. Thanks for helping the next traveller.");
      form.reset(); setFormOpen(false);
      await mutate();
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "Could not publish. Please try again."); }
    finally { setPending(false); }
  }
  const reports = data?.reports ?? [];
  return <section className="traveller-updates subpanel stack" aria-labelledby={uid + "-heading"}>
    <div className="updates-heading">
      <div className="stack">
        <span className="tiny lime inline"><MessageSquare size={15} aria-hidden="true" /> FROM RECENT VISITORS</span>
        <h3 id={uid + "-heading"}>Traveller updates</h3>
        <p>Weather and crowd reports from people who visited {destinationName}.</p>
      </div>
      <button className="secondary" aria-expanded={formOpen} aria-controls={uid + "-form"}
        onClick={() => { setFormOpen(!formOpen); setSubmitError(""); setSuccess(""); }}>
        {formOpen ? "Close form" : "Share your visit"}
      </button>
    </div>
    <small>Self-reported visits from the last 7 days · latest 20 updates. Visits are not independently verified; conditions can change before your trip.</small>
    {success && <p className="lime" role="status">{success}</p>}
    {error ? <div className="stack"><p role="alert">Recent updates could not load. {error.message}</p>
      <button className="secondary" disabled={isValidating} onClick={() => mutate()}>Retry updates</button></div>
      : !data ? <p role="status">Loading recent visits…</p>
      : data.summary.count > 0 ? <>
        <div className="updates-summary">
          <div><CloudSun size={19} className="lime" aria-hidden="true" /><small>REPORTED WEATHER</small><strong>{common(data.summary.weather, WEATHER_OPTIONS)}</strong></div>
          <div><Users size={19} className="lime" aria-hidden="true" /><small>REPORTED CROWD</small><strong>{common(data.summary.crowd, CROWD_OPTIONS)}</strong></div>
          <div><MessageSquare size={19} className="lime" aria-hidden="true" /><small>VISITOR TAKE</small><strong>{data.summary.experience.go || 0} of {data.summary.count} say worth visiting</strong></div>
        </div>
        <div className="updates-list">
          {(showAll ? reports : reports.slice(0, 3)).map((report) => <article key={report.id} className="visit-report stack">
            <div className="row"><strong>{report.name}</strong><small>Visited {dateLabel(report.visitedOn)}</small></div>
            <div className="chips"><span className="chip">{WEATHER_OPTIONS[report.weather]}</span><span className="chip">{CROWD_OPTIONS[report.crowd]}</span><span className="chip">{EXPERIENCE_OPTIONS[report.experience]}</span></div>
            {report.note && <p className="visit-note">{report.note}</p>}
            <small>Updated {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(report.updatedAt))} IST</small>
          </article>)}
        </div>
        {reports.length > 3 && <button className="secondary" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer visits" : "Read all " + reports.length + " updates"}</button>}
      </> : <div className="updates-empty"><MessageSquare size={24} className="lime" aria-hidden="true" /><p>No recent reports for {destinationName} yet.</p><small>Been here this week? Share what the weather and crowd were like.</small></div>}
    {formOpen && <form id={uid + "-form"} className="stack updates-form" onSubmit={submit}>
      <h3>How was your visit?</h3>
      <p>Your update will be public. Share firsthand observations and leave out phone numbers or other private details.</p>
      <div className="two-cols">
        <label className="field">Display name (optional)<input name="name" maxLength={40} autoComplete="nickname" placeholder="Traveller" /></label>
        <label className="field">When did you visit? (IST)<input name="visitedOn" type="date" required min={addDays(today, -6)} max={today} defaultValue={today} /></label>
        <label className="field">Weather during your visit<select name="weather" required defaultValue=""><option value="" disabled>Choose weather</option>{Object.entries(WEATHER_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field">How crowded was it?<select name="crowd" required defaultValue=""><option value="" disabled>Choose crowd level</option>{Object.entries(CROWD_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <label className="field">Would you suggest visiting in these conditions?<select name="experience" required defaultValue=""><option value="" disabled>Choose your take</option>{Object.entries(EXPERIENCE_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="field">Anything helpful? (optional, up to 280 characters)<textarea name="note" rows={3} maxLength={280} placeholder="For example: Light rain in the afternoon; the main market got busy after 5 pm." /></label>
      <label className="visit-confirm"><input type="checkbox" name="visited" required />I visited this place on the date above, and this is my own experience.</label>
      {submitError && <p role="alert">{submitError}</p>}
      <div className="panel-actions"><button className="primary" disabled={pending} type="submit">{pending ? "Publishing…" : "Publish update"}</button><small>One update per visit day on this browser. Submitting again updates it.</small></div>
    </form>}
  </section>;
}
