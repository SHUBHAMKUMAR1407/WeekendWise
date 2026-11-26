import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return <main className="wrap inner"><section className="panel stack">
    <h1>Privacy</h1>
    <p>Authorized administrators can search retained trip participant names and public visitor report names to support the service. Names are self-entered and are not verified identities. Admin searches do not connect anonymous crowd check-ins to named travellers. Admin access uses a short-lived HTTP-only session cookie.</p>
    <p>Crowd check-ins are optional. With your agreement, your browser sends location, accuracy and a timestamp to our server to check proximity to a destination. These location fields are discarded after validation. We store the destination, day, crowd observation and a hashed browser key for up to 30 days; no raw IP or precise location is stored for crowd counting. Trip interest stores a destination and selected dates for up to 30 days and can be removed using “Remove my interest”. Public crowd history contains daily aggregates, with no names or browser keys, and covers today and the previous four days in IST. Check-ins and reports are user observations, not verified footfall.</p>
    <p>Traveller updates are public: your display name, visit date, weather, crowd level, recommendation and note are visible to other visitors. Reports expire 30 days after the visit; only visits from the last seven days appear in recent updates. A hashed browser identifier lets you edit a report for the same destination and visit day. Raw browser identifiers are not included in public reports. Do not put private contact details in a report.</p>
    <p>Trip rooms contain names and trip choices and expire after 30 days. Anonymous browser identifiers help measure usage. The app records aggregate planning events.</p>
    <p>When live address search is configured, the text you type is sent through our server to Google Maps Places to return suggestions. Suggested addresses stay in the search interface. The trip stores the matched supported departure city. Search text is excluded from our analytics.</p>
    <p>Google processes requests according to its privacy policy. <a className="linkbtn" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></p>
    <Link className="linkbtn" href="/">Back to planner</Link>
  </section></main>;
}
