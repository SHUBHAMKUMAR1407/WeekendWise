import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return <main className="wrap inner"><section className="panel stack">
    <h1>Privacy</h1>
    <p>Traveller updates are public: your display name, visit date, weather, crowd level, recommendation and note are visible to other visitors. Reports expire 30 days after the visit; only visits from the last seven days appear in recent updates. A hashed browser identifier lets you edit a report for the same destination and visit day. Raw browser identifiers are not included in public reports. Do not put private contact details in a report.</p>
    <p>Trip rooms contain names and trip choices and expire after 30 days. Anonymous browser identifiers help measure usage. The app records aggregate planning events.</p>
    <p>When live address search is configured, the text you type is sent through our server to Google Maps Places to return suggestions. Suggested addresses stay in the search interface. The trip stores the matched supported departure city. Search text is excluded from our analytics.</p>
    <p>Google processes requests according to its privacy policy. <a className="linkbtn" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></p>
    <Link className="linkbtn" href="/">Back to planner</Link>
  </section></main>;
}
