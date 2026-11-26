"use client";
import { useState } from "react";
import TravellerUpdates from "./TravellerUpdates";
import CrowdInsights from "./CrowdInsights";
export default function UpdatesExplorer({ destinations }: { destinations: { id: string; name: string; state: string }[] }) {
  const [id, setId] = useState(destinations[0].id);
  const selected = destinations.find((d) => d.id === id)!;
  return <div className="stack">
    <label className="field updates-destination">Choose a destination<select value={id} onChange={(event) => setId(event.target.value)}>
      {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}, {destination.state}</option>)}
    </select></label>
    <CrowdInsights key={"crowd-" + id} destinationId={id} destinationName={selected.name} />
    <TravellerUpdates key={id} destinationId={id} destinationName={selected.name} />
  </div>;
}
