import Link from "next/link";

export const metadata = { title: "Terms" };

export default function Terms() {
  return <main className="wrap inner"><section className="panel stack">
    <h1>Terms of use</h1>
    <p>WeekendWise helps you compare travel plans. Costs, transport windows and crowd levels are estimates. Check current fares, timings, weather and local conditions before booking.</p>
    <p>Live address suggestions are provided by Google Maps when configured. Use of these features is subject to the Google Maps terms. <a className="linkbtn" href="https://www.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps Terms of Service</a></p>
    <Link className="linkbtn" href="/">Back to planner</Link>
  </section></main>;
}
