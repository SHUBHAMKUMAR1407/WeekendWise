import records from "../../../../backend/data/destinations.json";
import UpdatesExplorer from "@frontend/components/trip/UpdatesExplorer";
export const metadata = { title: "Traveller updates" };
export default function Updates() {
  const destinations = records.map(({ id, name, state }) => ({ id, name, state })).sort((a, b) => a.name.localeCompare(b.name));
  return <main className="wrap inner stack updates-page">
    <div className="eyebrow"><span /> BEFORE YOU GO</div>
    <h1>Been there?<br /><span className="lime">Help the next traveller.</span></h1>
    <p className="updates-intro">See what recent visitors say about the weather and crowds, or share an update from your own visit. Use their experiences alongside your trip’s forecast to decide when to go.</p>
    <UpdatesExplorer destinations={destinations} />
  </main>;
}
