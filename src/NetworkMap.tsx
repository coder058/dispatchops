import { MapPin, Truck } from "lucide-react";
import { formatTime, previewAssignment, type GameState, type Zone } from "./game";

// SOURCE: illustrative SVG layout; positions are a schematic of the five game zones, not coordinates.
const points: Record<Zone, { x: number; y: number }> = {
  Noord: { x: 470, y: 92 }, West: { x: 145, y: 270 },
  Centrum: { x: 445, y: 295 }, Oost: { x: 765, y: 250 }, Zuid: { x: 475, y: 492 },
};

export default function NetworkMap({ state, selectJob }: { state: GameState; selectJob: (id: string) => void }) {
  const selected = state.jobs.find((job) => job.id === state.selectedJobId);
  const active = state.jobs.filter((job) => job.status !== "delivered" && job.releasedAt <= state.time);
  return (
    <section className="network-panel">
      <header className="panel-header">
        <div><h2>Amsterdam dispatch map</h2><p>Select a delivery below a zone. Dashed lines show assigned routes.</p></div>
        <span className="schematic-label">Fictional scenario</span>
      </header>
      <p className="map-pan-hint">Swipe the map sideways to see every zone, or use the delivery list below.</p>
      <svg className="dispatch-map" viewBox="0 0 920 620" role="group" aria-label="Amsterdam schematic showing delivery destinations and driver routes">
        <defs>
          <pattern id="street-grid" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="#cad4c8" strokeWidth="2" /></pattern>
        </defs>
        <rect width="920" height="620" fill="#e2e9dc" />
        <rect width="920" height="620" fill="url(#street-grid)" />
        <path d="M-20 155 Q220 95 340 164 T940 129" fill="none" stroke="#9ebfc4" strokeWidth="44" />
        <path d="M460 181 Q400 317 520 425 T560 650" fill="none" stroke="#9ebfc4" strokeWidth="18" />
        <path d="M135 220 Q240 170 415 217 T789 210 L790 430 Q695 554 400 554 T135 220Z" fill="none" stroke="#f9faf0" strokeWidth="18" />
        <path d="M145 270 Q290 250 445 295 T765 250 M445 295 L475 492 M445 295 L470 92" fill="none" stroke="#f9faf0" strokeWidth="13" />
        <text x="55" y="139" className="water-label">IJ river</text>
        <text x="665" y="562" className="map-footnote">Schematic · travel times are game data</text>
        {active.filter((job) => job.status === "assigned" && job.originZone).map((job) => {
          const from = points[job.originZone!], to = points[job.zone];
          return <path key={job.id} className="delivery-route" d={`M${from.x} ${from.y} Q${(from.x + to.x) / 2 + 35} ${Math.min(from.y, to.y) - 55} ${to.x} ${to.y}`} />;
        })}
        {Object.entries(points).map(([zone, point]) => {
          const jobs = active.filter((job) => job.zone === zone);
          return <g key={zone}>
            <circle cx={point.x} cy={point.y} r="11" fill="#263d33" stroke="white" strokeWidth="4" />
            <rect x={point.x - 60} y={point.y - 39} width="120" height="24" rx="4" fill="#fffdf8" />
            <text x={point.x} y={point.y - 22} className="map-zone-name" textAnchor="middle">{zone}</text>
            {jobs.map((job, index) => <g key={job.id}>
              <foreignObject x={point.x - 112} y={point.y + 19 + index * 57} width="224" height="55">
                <button className={`map-delivery ${job.priority} ${job.status} ${selected?.id === job.id ? "selected" : ""}`} onClick={() => selectJob(job.id)} aria-label={`Select ${job.reference}: ${job.title}`}>
                  <strong>{job.title}</strong><span>{job.status === "assigned" ? `${job.driverId} · arrival ${formatTime(job.completeAt!)}` : `${job.skill ?? "standard"} · due ${formatTime(job.dueAt)}`}</span>
                </button>
              </foreignObject>
            </g>)}
            {!jobs.length && <text x={point.x} y={point.y + 32} className="map-clear" textAnchor="middle">All clear</text>}
          </g>;
        })}
        {state.drivers.map((driver) => {
          const currentJob = active.filter((job) => job.driverId === driver.id && job.beginsAt !== null && job.beginsAt <= state.time)
            .sort((a, b) => (a.completeAt ?? 0) - (b.completeAt ?? 0))[0];
          const origin = currentJob?.originZone ? points[currentJob.originZone] : points[driver.zone];
          const destination = currentJob ? points[currentJob.zone] : origin;
          // SOURCE: interpolate the visual position using elapsed synthetic travel time; exact GPS is unavailable.
          const fraction = currentJob ? Math.max(0, Math.min(1, (state.time - currentJob.beginsAt!) / currentJob.travelMinutes)) : 0;
          const x = origin.x + (destination.x - origin.x) * fraction;
          const y = origin.y + (destination.y - origin.y) * fraction;
          const slot = state.drivers.filter((item) => item.zone === driver.zone).findIndex((item) => item.id === driver.id);
          return <g key={driver.id} className={driver.available ? "map-vehicle" : "map-vehicle offline"} transform={`translate(${x - 89 + slot * 42},${y - 8})`}>
            <title>{driver.name}: {driver.available ? currentJob ? `travelling to ${currentJob.zone}` : "idle" : "offline"}</title>
            <rect width="38" height="24" rx="5" /><text x="19" y="16" textAnchor="middle">{driver.id}</text>
          </g>;
        })}
      </svg>
      <div className="map-fleet">
        {state.drivers.map((driver) => <div key={driver.id} className={!driver.available ? "fleet-offline" : ""}>
          <strong><Truck size={16} />{driver.id}</strong>
          <span>{driver.available ? driver.assigned ? `${driver.assigned}/${driver.capacity} jobs` : "Available" : "Offline"}</span>
          <small>{driver.skills.join(" · ")}</small>
        </div>)}
      </div>
      <footer className="board-legend"><span><i className="legend-urgent" />Urgent delivery</span><span><i className="legend-job" />Waiting delivery</span><span><MapPin size={14} />Destination zone</span></footer>
      {selected?.status === "waiting" && <p className="map-selection">Selected: <strong>{selected.title}</strong> · {state.drivers.filter((driver) => driver.available && (!selected.skill || driver.skills.includes(selected.skill))).map((driver) => `${driver.id} arrives ${formatTime(previewAssignment(state, selected, driver).completeAt)}`).join(" / ")}</p>}
    </section>
  );
}
