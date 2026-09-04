import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Gauge,
  HelpCircle,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  SHIFT_END,
  TICK_INTERVAL_FAST_MS,
  TICK_INTERVAL_MS,
  advanceTime,
  assignJob,
  canAssign,
  createInitialGame,
  finishShift,
  formatTime,
  gameResult,
  minutesToDue,
  proposeAssignment,
  startGame,
  type GameDriver,
  type GameJob,
  type GameState,
} from "./game";

function dueCopy(job: GameJob, now: number): string {
  const remaining = minutesToDue(job, now);
  if (remaining < 0) return `${Math.abs(remaining)} min past target`;
  return `${remaining} min remaining`;
}

function Briefing({ onStart }: { onStart: () => void }) {
  return (
    <main className="briefing">
      <header className="briefing-nav">
        <span className="brand"><Route size={19} />DispatchOps</span>
        <span>Synthetic Amsterdam shift</span>
      </header>
      <section className="briefing-hero">
        <div className="briefing-title">
          <p>Friday shift · 09:00</p>
          <h1>KEEP THE<br />NETWORK<br /><em>MOVING.</em></h1>
        </div>
        <div className="briefing-copy">
          <p>You are the shift lead. Assign the queue, watch the network move and respond when the plan changes.</p>
          <button className="start-button" onClick={onStart}><Play size={18} fill="currentColor" />Start the shift</button>
          <small>No login · fictional scenario</small>
        </div>
      </section>
      <section className="briefing-rules">
        <article><h2>Read the queue</h2><p>Deadlines, handling requirements and locations compete for attention.</p></article>
        <article><h2>Choose the operator</h2><p>Assign manually or inspect the recommendation and its reasons.</p></article>
        <article><h2>Watch the shift</h2><p>The clock runs automatically. Pause when you need to inspect a decision, then resume.</p></article>
      </section>
    </main>
  );
}

function FirstShiftOnboarding({
  step,
  setStep,
  onDismiss,
}: {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  onDismiss: () => void;
}) {
  const steps = [
    {
      tag: "STEP 1 · SELECT JOB",
      title: "Read the queue & pick a delivery",
      copy: "Click a waiting card in the queue or a map marker. Urgent jobs have tighter SLA deadlines and special handling needs.",
    },
    {
      tag: "STEP 2 · MATCH SKILLS",
      title: "Verify certifications & capacity",
      copy: "Specialist jobs (cold-chain, fragile, bulky, same-day) require certified drivers. Each driver holds up to 2 active assignments.",
    },
    {
      tag: "STEP 3 · ASSIGN & ADVANCE",
      title: "Review the proposal or assign manually",
      copy: "Accept the rules-based recommendation or choose an eligible driver. Watch vehicles travel and resolve deliveries as the shift advances.",
    },
  ];
  const current = steps[step] ?? steps[0];

  return (
    <section className="onboarding-banner" aria-label="First shift onboarding walkthrough">
      <div className="onboarding-badge">
        <Sparkles size={14} />
        <span>FIRST-SHIFT GUIDE</span>
        <span className="onboarding-step-count">{step + 1}/3</span>
      </div>
      <div className="onboarding-content">
        <h3><strong>{current.tag}:</strong> {current.title}</h3>
        <p>{current.copy}</p>
      </div>
      <div className="onboarding-actions">
        {step > 0 && (
          <button type="button" className="onboarding-btn-nav" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft size={13} /> Prev
          </button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="onboarding-btn-nav" onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight size={13} />
          </button>
        ) : (
          <button type="button" className="onboarding-btn-primary" onClick={onDismiss}>
            <Check size={13} /> Got it
          </button>
        )}
        <button type="button" className="onboarding-btn-close" onClick={onDismiss} aria-label="Dismiss guide">
          <X size={14} />
        </button>
      </div>
    </section>
  );
}

function NetworkMap({ state, selectJob }: { state: GameState; selectJob: (id: string) => void }) {
  const activeJobs = state.jobs.filter((job) => job.releasedAt <= state.time && job.status !== "delivered");
  return (
    <section className="network-panel">
      <header className="panel-header"><div><span>SYNTHETIC MAP</span><h2>Amsterdam network</h2></div><span className="live"><CircleDot size={12} />RUNNING</span></header>
      <div className="network-map">
      <svg className="amsterdam-map" viewBox="0 0 800 530" role="img" aria-label="Stylised map of Amsterdam with the IJ, canals, Amstel and ring road">
        <rect width="800" height="530" fill="#d7e0da" />
        <path className="map-water" d="M0 72 C120 52 188 92 280 73 C385 51 446 75 540 56 C650 34 718 59 800 41 L800 0 L0 0Z" />
        <path className="map-water" d="M391 78 C370 146 389 204 376 258 C363 325 395 388 379 530 L445 530 C424 421 435 343 421 274 C409 205 431 140 425 79Z" />
        <path className="map-ring" d="M168 176 C208 103 339 90 480 112 C610 132 675 224 644 347 C614 466 481 487 328 467 C190 450 112 347 135 248 C142 217 153 195 168 176Z" />
        <path className="map-road" d="M207 126 C296 180 332 222 386 265 C447 313 510 349 615 377" />
        <path className="map-road" d="M180 388 C274 342 302 306 386 265 C469 224 531 182 631 167" />
        <path className="map-canal" d="M292 145 C280 205 283 284 306 355 C318 394 332 419 348 449" />
        <path className="map-canal" d="M474 133 C458 190 451 233 459 281 C469 343 502 391 536 431" />
        <path className="map-canal" d="M220 252 C289 235 342 239 387 265 C439 296 484 301 567 277" />
        <g className="map-labels">
          <text x="44" y="45">AMSTERDAM / IJ</text><text x="68" y="235">WEST</text><text x="344" y="245">CENTRUM</text><text x="655" y="235">OOST</text><text x="351" y="490">ZUID</text><text x="485" y="113">NOORD</text>
        </g>
        <g className="map-landmark"><circle cx="386" cy="265" r="5" /><text x="398" y="269">CENTRAL STATION</text></g>
      </svg>
        {(["Noord", "West", "Centrum", "Oost", "Zuid"] as const).map((zone) => <span key={zone} className={`zone-label zone-${zone.toLowerCase()}`}>{zone}</span>)}
        {state.drivers.map((driver) => (
          <div key={driver.id} className={`driver-marker marker-${driver.zone.toLowerCase()} ${driver.available ? "" : "offline"}`} title={`${driver.name} · ${driver.zone} · Skills: ${driver.skills.join(", ")}`}>
            <Truck size={13} /><span>{driver.id}</span>
          </div>
        ))}
        {activeJobs.map((job, index) => (
          <button key={job.id} className={`job-marker marker-${job.zone.toLowerCase()} offset-${index % 3} ${job.priority} ${state.selectedJobId === job.id ? "selected" : ""}`} onClick={() => selectJob(job.id)} aria-label={`Select ${job.reference}`}>
            <span>{job.reference.replace("DX-", "")}</span>
          </button>
        ))}
        <div className="map-key"><span><i className="urgent" />Urgent</span><span><i />Waiting</span><span><Truck size={11} />Driver</span></div>
      </div>
    </section>
  );
}

function DriverChoice({ driver, job, state, onAssign }: { driver: GameDriver; job: GameJob; state: GameState; onAssign: () => void }) {
  const eligibility = canAssign(state, job, driver);
  return (
    <button className={`driver-choice ${eligibility.allowed ? "" : "disabled"}`} disabled={!eligibility.allowed} onClick={onAssign}>
      <span className="driver-code">{driver.id}</span>
      <span className="driver-info-block">
        <strong>{driver.name}</strong>
        <small>{driver.zone} · {driver.assigned}/{driver.capacity} active {!driver.available ? "(offline)" : driver.assigned > 0 ? `(busy until ${formatTime(driver.availableAt)})` : "(ready)"}</small>
        <span className="driver-skill-tags">
          {driver.skills.map((skill) => (
            <span key={skill} className={`driver-skill-tag ${job.skill === skill ? "matched" : ""}`}>
              {skill}
            </span>
          ))}
        </span>
      </span>
      <span className="eligibility">{eligibility.allowed ? <ChevronRight size={16} /> : eligibility.reason}</span>
    </button>
  );
}

function DecisionDesk({ state, selectedJob, selectJob, manualAssign, agentAssign }: {
  state: GameState;
  selectedJob: GameJob | null;
  selectJob: (id: string | null) => void;
  manualAssign: (driverId: string) => void;
  agentAssign: (driverId: string) => void;
}) {
  const proposal = selectedJob ? proposeAssignment(state, selectedJob.id) : null;
  if (!selectedJob) {
    return (
      <aside className="decision-panel empty-decision">
        <div className="decision-number">DECISION DESK</div>
        <MapPin size={31} />
        <h2>Select a waiting job</h2>
        <p>Choose a marker on the network or a card from the queue. You can then compare every eligible driver.</p>
      </aside>
    );
  }
  const remaining = minutesToDue(selectedJob, state.time);
  const isUrgentSla = remaining <= 20;
  return (
    <aside className="decision-panel">
      <div className="decision-top"><span>DECISION DESK</span><button onClick={() => selectJob(null)} aria-label="Close decision"><X size={16} /></button></div>
      <div className="selected-job">
        <span className={`priority-tag ${selectedJob.priority}`}>{selectedJob.priority}</span>
        <h2>{selectedJob.title}</h2>
        <p>{selectedJob.reference} · {selectedJob.zone}</p>
        <div>
          <span>Target SLA {formatTime(selectedJob.dueAt)}</span>
          <strong className={remaining < 0 ? "sla-danger" : isUrgentSla ? "sla-warn-text" : ""}>{dueCopy(selectedJob, state.time)}</strong>
        </div>
        {selectedJob.skill && (
          <div className="required-skill-row">
            <span>Required skill</span>
            <strong className="skill-highlight">{selectedJob.skill}</strong>
          </div>
        )}
      </div>
      {proposal && (
        <article className="agent-proposal">
          <header><span><Sparkles size={14} />ASSIGNMENT PROPOSAL</span><strong>{proposal.driverId}</strong></header>
          <ul>{proposal.reasons.map((reason) => <li key={reason}><Check size={12} />{reason}</li>)}</ul>
          <button onClick={() => agentAssign(proposal.driverId)}><Zap size={14} fill="currentColor" />Accept proposal</button>
        </article>
      )}
      <div className="manual-list"><span>OR ASSIGN MANUALLY</span>{state.drivers.map((driver) => <DriverChoice key={driver.id} driver={driver} job={selectedJob} state={state} onAssign={() => manualAssign(driver.id)} />)}</div>
    </aside>
  );
}

function JobQueue({ state, selectJob }: { state: GameState; selectJob: (id: string) => void }) {
  const visible = state.jobs.filter((job) => job.releasedAt <= state.time);
  return (
    <section className="queue-section">
      <header><div><span>ACTIVE MANIFEST</span><h2>Dispatch queue</h2></div><strong>{visible.filter((job) => job.status === "waiting").length} waiting</strong></header>
      <div className="game-queue">
        {visible.map((job) => {
          const remaining = minutesToDue(job, state.time);
          const isUrgentSla = job.status === "waiting" && remaining <= 20;
          const assignedDriver = job.driverId ? state.drivers.find((d) => d.id === job.driverId) : null;
          return (
            <button
              key={job.id}
              className={`game-job ${job.status} ${job.priority} ${state.selectedJobId === job.id ? "selected" : ""} ${isUrgentSla ? "is-sla-urgent" : ""}`}
              onClick={() => job.status === "waiting" && selectJob(job.id)}
              disabled={job.status !== "waiting"}
            >
              <div><span>{job.reference}</span><span>{job.priority}</span></div>
              <h3>{job.title}</h3>
              <p>{job.zone}{job.skill ? ` · [${job.skill}]` : " · standard"}</p>
              <footer>
                <span>
                  {job.status === "delivered" ? (
                    job.late ? "Delivered late" : "Delivered on time"
                  ) : job.status === "assigned" ? (
                    `In transit (${assignedDriver?.name ?? job.driverId}) · ETA ${formatTime(job.completeAt ?? state.time)}`
                  ) : (
                    <span className={remaining < 0 ? "sla-danger" : isUrgentSla ? "sla-warn-text" : ""}>
                      {dueCopy(job, state.time)}
                    </span>
                  )}
                </span>
                {job.status === "waiting" && <ChevronRight size={15} />}
              </footer>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Timeline({ state }: { state: GameState }) {
  return (
    <section className="timeline-panel">
      <header><span>SHIFT LOG</span><strong>{state.log.length.toString().padStart(2, "0")} events</strong></header>
      <div>{[...state.log].sort((a, b) => b.at - a.at).slice(0, 6).map((entry, index) => <article key={`${entry.at}-${index}`} className={entry.kind}><time>{formatTime(entry.at)}</time><p>{entry.text}</p></article>)}</div>
    </section>
  );
}

function Game({ state, setState }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>> }) {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<"normal" | "fast">("normal");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const selectedJob = state.jobs.find((job) => job.id === state.selectedJobId) ?? null;
  const latestEvent = state.events.filter((event) => state.triggeredEventIds.includes(event.id)).at(-1);
  const progress = ((state.time - 9 * 60) / (SHIFT_END - 9 * 60)) * 100; // SOURCE: progress is derived from the documented shift bounds.

  useEffect(() => {
    if (state.phase !== "playing" || !running) return;
    const interval = speed === "fast" ? TICK_INTERVAL_FAST_MS : TICK_INTERVAL_MS;
    const timer = window.setInterval(() => setState((current) => advanceTime(current)), interval);
    return () => window.clearInterval(timer);
  }, [running, speed, setState, state.phase]);

  useEffect(() => {
    if (state.phase === "complete") setRunning(false);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "playing" && state.triggeredEventIds.length > 0) setRunning(false);
  }, [state.phase, state.triggeredEventIds.length]);

  const selectJob = (id: string | null) => {
    setState((current) => ({ ...current, selectedJobId: id }));
    if (id && onboardingStep === 0) setOnboardingStep(1);
  };

  const assign = (driverId: string, source: "agent" | "manual") => {
    if (!selectedJob) return;
    setState((current) => assignJob(current, selectedJob.id, driverId, source));
    if (onboardingStep === 1) setOnboardingStep(2);
  };

  return (
    <div className="game-shell">
      <header className="game-header">
        <span className="brand"><Route size={18} />DispatchOps</span>
        <div className="shift-clock"><Clock3 size={15} /><span>SHIFT TIME</span><strong>{formatTime(state.time)}</strong></div>
        <div className="header-buttons">
          <button onClick={() => setRunning((current) => !current)}>
            {running ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            {running ? "Pause clock" : "Resume clock"}
          </button>
          <button
            className={`speed-button ${speed === "fast" ? "speed-fast" : ""}`}
            onClick={() => setSpeed((s) => (s === "normal" ? "fast" : "normal"))}
            title={speed === "normal" ? "Switch to Fast mode (7s per 15m turn)" : "Switch to Normal pace (22s per 15m turn)"}
          >
            <Zap size={14} fill={speed === "fast" ? "currentColor" : "none"} />
            {speed === "fast" ? "Fast (7s)" : "Normal (22s)"}
          </button>
          <button className="quiet" onClick={() => setState((current) => advanceTime(current))}>
            <ChevronRight size={14} />Skip 15 min
          </button>
          <button className="quiet" onClick={() => { setRunning(false); setState((current) => finishShift(current)); }}>
            <TimerReset size={14} />End shift
          </button>
        </div>
      </header>
      <div className="time-track"><span style={{ width: `${Math.min(100, progress)}%` }} /></div>

      {showOnboarding && (
        <FirstShiftOnboarding
          step={onboardingStep}
          setStep={setOnboardingStep}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      {latestEvent && latestEvent.at === state.time && (
        <div className={`incident-banner ${latestEvent.kind}`}>
          <AlertTriangle size={17} />
          <div className="incident-body">
            <strong>{latestEvent.title}</strong>
            <span>{latestEvent.detail}</span>
          </div>
          <div className="incident-actions">
            {latestEvent.kind === "new-job" && (
              <button type="button" className="incident-btn" onClick={() => selectJob("J6")}>
                <Zap size={13} fill="currentColor" /> Select J6
              </button>
            )}
            {latestEvent.kind === "breakdown" && (
              <button type="button" className="incident-btn" onClick={() => selectJob(state.jobs.find((j) => j.status === "waiting")?.id ?? null)}>
                <AlertTriangle size={13} /> Reassign queue
              </button>
            )}
            <button type="button" className="incident-btn-resume" onClick={() => setRunning(true)}>
              <Play size={13} fill="currentColor" /> Resume
            </button>
          </div>
        </div>
      )}

      <main className="game-main">
        <section className="game-metrics">
          <article><Activity size={16} /><span>WAITING</span><strong>{state.jobs.filter((job) => job.releasedAt <= state.time && job.status === "waiting").length}</strong></article>
          <article><Truck size={16} /><span>ACTIVE</span><strong>{state.jobs.filter((job) => job.status === "assigned").length}</strong></article>
          <article><Check size={16} /><span>DELIVERED</span><strong>{state.jobs.filter((job) => job.status === "delivered").length}</strong></article>
          <article><AlertTriangle size={16} /><span>INCIDENTS</span><strong>{state.triggeredEventIds.length}</strong></article>
        </section>
        <div className={`play-prompt ${running ? "is-running" : "is-paused"}`}>
          <span>{running ? <CircleDot size={14} /> : <Pause size={14} />}</span>
          <strong>{running ? "The shift is live." : "The clock is paused."}</strong>
          <span>Select a waiting job, match driver certifications, then watch the delivery resolve.</span>
          {!showOnboarding && (
            <button type="button" className="prompt-guide-btn" onClick={() => { setShowOnboarding(true); setOnboardingStep(0); }}>
              <HelpCircle size={12} /> First-shift guide
            </button>
          )}
        </div>
        <section className="operations-grid"><NetworkMap state={state} selectJob={selectJob} /><DecisionDesk state={state} selectedJob={selectedJob} selectJob={selectJob} manualAssign={(driverId) => assign(driverId, "manual")} agentAssign={(driverId) => assign(driverId, "agent")} /></section>
        <JobQueue state={state} selectJob={selectJob} />
        <Timeline state={state} />
      </main>
    </div>
  );
}

function Debrief({ state, restart }: { state: GameState; restart: () => void }) {
  const result = gameResult(state);
  return (
    <main className="debrief">
      <header className="debrief-nav"><span className="brand"><Route size={18} />DispatchOps</span><span>SHIFT DEBRIEF / {formatTime(state.time)}</span></header>
      <section className="score-hero">
        <div><p>SYNTHETIC OPERATIONAL SCORE</p><strong>{result.score}</strong><span>/100</span></div>
        <div><p>SHIFT STATUS</p><h1>{result.rating}.</h1><span>This score is a game mechanic, not an operational benchmark.</span></div>
      </section>
      <section className="result-grid">
        <article><Check /><span>COMPLETED</span><strong>{result.delivered}/{result.total}</strong></article>
        <article><Clock3 /><span>ON TARGET</span><strong>{result.onTime}/{result.delivered}</strong></article>
        <article><Route /><span>SYNTHETIC TRAVEL</span><strong>{result.travelMinutes}m</strong></article>
        <article><Bot /><span>PROPOSAL / MANUAL</span><strong>{result.agentAccepted}/{result.manualAssignments}</strong></article>
      </section>
      <section className="debrief-body">
        <div className="decision-review"><span>DECISION REVIEW</span><h2>Your shift,<br />decision by decision.</h2><p>{result.forcedReassignments ? `${result.forcedReassignments} assignment required replanning after a vehicle incident.` : "No active assignment was displaced by the vehicle incident."}</p><button onClick={restart}><RefreshCw size={15} />Replay identical scenario</button></div>
        <div className="full-log">{[...state.log].sort((a, b) => a.at - b.at).map((entry, index) => <article key={`${entry.at}-${index}`}><time>{formatTime(entry.at)}</time><span>{entry.kind}</span><p>{entry.text}</p></article>)}</div>
      </section>
      <footer className="debrief-footer"><span><ShieldCheck size={14} />Deterministic engine</span><span><Gauge size={14} />Transparent score</span><span><Users size={14} />Human-in-the-loop</span><span><TimerReset size={14} />Replayable</span></footer>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState(createInitialGame);
  const screen = useMemo(() => state.phase, [state.phase]);
  if (screen === "briefing") return <Briefing onStart={() => setState((current) => startGame(current))} />;
  if (screen === "complete") return <Debrief state={state} restart={() => setState(createInitialGame())} />;
  return <Game state={state} setState={setState} />;
}
