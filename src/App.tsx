import { useEffect, useRef, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import NetworkMap from "./NetworkMap";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
  HelpCircle,
  ListChecks,
  PackageCheck,
  Play,
  RefreshCw,
  Route,
  ShieldCheck,
  TimerReset,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  SHIFT_END,
  SHIFT_START,
  TICK_MINUTES,
  advanceTime,
  assignJob,
  canAssign,
  createInitialGame,
  finishShift,
  formatTime,
  gameResult,
  minutesToDue,
  proposeAssignment,
  previewAssignment,
  startGame,
  type GameDriver,
  type GameJob,
  type GameState,
} from "./game";


function dueCopy(job: GameJob, now: number): string {
  const remaining = minutesToDue(job, now);
  if (remaining < 0) return `${Math.abs(remaining)} min past target`;
  return `${remaining} min left`;
}

function HowToPlay({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "how-to compact" : "how-to"} aria-label="How to play">
      {!compact && (
        <header className="section-heading">
          <span>How to play</span>
          <h2>Three moves. Every choice has a consequence.</h2>
        </header>
      )}
      <div className="how-to-grid">
        <article>
          <strong>1</strong>
          <div><h3>Choose a delivery</h3><p>Start with a waiting card. Check its target time, zone and required handling skill.</p></div>
        </article>
        <article>
          <strong>2</strong>
          <div><h3>Assign a driver</h3><p>Use the suggested match or compare drivers yourself. A driver needs the right skill and free capacity.</p></div>
        </article>
        <article>
          <strong>3</strong>
          <div><h3>Advance one turn</h3><p>Move the clock by 15 minutes. Deliveries finish and new incidents can force you to replan.</p></div>
        </article>
      </div>
    </section>
  );
}

function Briefing({ onStart }: { onStart: () => void }) {
  return (
    <main className="briefing">
      <header className="briefing-nav">
        <span className="brand"><Route size={21} />DispatchOps</span>
        <span className="scenario-label">Playable portfolio project · fictional data</span>
      </header>

      <section className="briefing-layout">
        <div className="briefing-intro">
          <span className="eyebrow">Dispatch decision game</span>
          <h1>Run a delivery shift when the plan keeps changing.</h1>
          <p className="briefing-lede">
            You are the dispatcher for a fictional Amsterdam network. Match each delivery to an eligible driver, protect its target time and respond when an urgent job, a vehicle failure and a road restriction change the plan.
          </p>
          <div className="briefing-actions">
            <button className="start-button" onClick={onStart}>
              Start guided shift <ArrowRight size={19} />
            </button>
            <span>No login · turn-based · play at your own pace</span>
          </div>
        </div>

        <aside className="mission-card">
          <span className="mission-kicker"><Gauge size={16} /> Your objective</span>
          <h2>Deliver every job before its target time.</h2>
          <ul>
            <li><Check size={16} /> Match specialist handling skills</li>
            <li><Check size={16} /> Keep driver capacity available</li>
            <li><Check size={16} /> Reassign work after incidents</li>
          </ul>
          <p>The score is a transparent game mechanic. It is not a real logistics benchmark.</p>
        </aside>
      </section>

      <HowToPlay />
    </main>
  );
}

function DriverChoice({ driver, job, state, onAssign }: { driver: GameDriver; job: GameJob; state: GameState; onAssign: () => void }) {
  const eligibility = canAssign(state, job, driver);
  const plan = previewAssignment(state, job, driver);
  return (
    <button className={`driver-choice ${eligibility.allowed ? "" : "disabled"}`} disabled={!eligibility.allowed} onClick={onAssign}>
      <span className="driver-code">{driver.id}</span>
      <span className="driver-info-block">
        <strong>{driver.name}</strong>
        <small>{driver.zone} · {driver.assigned}/{driver.capacity} active{eligibility.allowed ? ` · arrival ${formatTime(plan.completeAt)}` : ""}</small>
        <span className="driver-skill-tags">
          {driver.skills.map((skill) => (
            <span key={skill} className={`driver-skill-tag ${job.skill === skill ? "matched" : ""}`}>{skill}</span>
          ))}
        </span>
      </span>
      <span className="eligibility">{eligibility.allowed ? <>Assign <ChevronRight size={16} /></> : eligibility.reason}</span>
    </button>
  );
}

function DecisionDesk({ state, selectedJob, selectJob, manualAssign, proposalAssign }: {
  state: GameState;
  selectedJob: GameJob | null;
  selectJob: (id: string | null) => void;
  manualAssign: (driverId: string) => void;
  proposalAssign: (driverId: string) => void;
}) {
  const proposal = selectedJob ? proposeAssignment(state, selectedJob.id) : null;
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selectedJob && window.matchMedia("(max-width: 1150px)").matches) panelRef.current?.scrollIntoView({ block: "start" });
  }, [selectedJob]);

  if (!selectedJob) {
    return (
      <aside className="decision-panel empty-decision">
        <span className="decision-number">Next decision</span>
        <div className="decision-icon"><ListChecks size={27} /></div>
        <h2>Choose a waiting delivery</h2>
        <p>Click any white or orange delivery card on the zone board. Its deadline and eligible drivers will appear here.</p>
        <ol>
          <li><strong>Read</strong> the target and skill</li>
          <li><strong>Compare</strong> the available drivers</li>
          <li><strong>Assign</strong> one and continue</li>
        </ol>
      </aside>
    );
  }

  const remaining = minutesToDue(selectedJob, state.time);
  return (
    <aside className="decision-panel" ref={panelRef} tabIndex={-1}>
      <div className="decision-top">
        <span>Selected delivery</span>
        <button onClick={() => selectJob(null)} aria-label="Close delivery details"><X size={18} /></button>
      </div>
      <div className="selected-job">
        <span className={`priority-tag ${selectedJob.priority}`}>{selectedJob.priority} priority</span>
        <h2>{selectedJob.title}</h2>
        <p>{selectedJob.reference} · destination {selectedJob.zone}</p>
        <dl>
          <div><dt>Target time</dt><dd>{formatTime(selectedJob.dueAt)}</dd></div>
          <div><dt>Time remaining</dt><dd className={remaining < 0 ? "sla-danger" : remaining <= 20 ? "sla-warn-text" : ""}>{dueCopy(selectedJob, state.time)}</dd></div>
          <div><dt>Required skill</dt><dd>{selectedJob.skill ?? "None"}</dd></div>
        </dl>
      </div>

      {selectedJob.status !== "waiting" ? (
        <p className="delivery-progress"><Truck size={18} />{selectedJob.status === "delivered" ? "Delivered" : `Assigned to ${selectedJob.driverId}. Arrival ${formatTime(selectedJob.completeAt!)}. Advance the clock to continue the route.`}</p>
      ) : proposal ? (
        <article className="recommendation-card">
          <header>
            <div><span>Suggested match</span><small>Based on skill, location and capacity</small></div>
            <strong>{proposal.driverId}</strong>
          </header>
          <ul>{proposal.reasons.map((reason) => <li key={reason}><Check size={14} />{reason}</li>)}</ul>
          <button onClick={() => proposalAssign(proposal.driverId)}><Zap size={15} />Assign to {proposal.driverId}</button>
        </article>
      ) : (
        <p className="no-match"><AlertTriangle size={16} /> No driver currently meets this delivery&apos;s requirements.</p>
      )}

      {selectedJob.status === "waiting" && <div className="manual-list">
        <span>Or compare every driver</span>
        {state.drivers.map((driver) => (
          <DriverChoice key={driver.id} driver={driver} job={selectedJob} state={state} onAssign={() => manualAssign(driver.id)} />
        ))}
      </div>}
    </aside>
  );
}

function JobQueue({ state, selectJob }: { state: GameState; selectJob: (id: string) => void }) {
  const visible = state.jobs.filter((job) => job.releasedAt <= state.time);
  const waiting = visible.filter((job) => job.status === "waiting").length;

  return (
    <section className="queue-section">
      <header>
        <div><span>Full manifest</span><h2>Every delivery at a glance</h2></div>
        <strong>{waiting} waiting</strong>
      </header>
      <div className="game-queue">
        {visible.map((job) => {
          const remaining = minutesToDue(job, state.time);
          const assignedDriver = job.driverId ? state.drivers.find((driver) => driver.id === job.driverId) : null;
          return (
            <button
              key={job.id}
              className={`game-job ${job.status} ${job.priority} ${state.selectedJobId === job.id ? "selected" : ""}`}
              onClick={() => job.status === "waiting" && selectJob(job.id)}
              disabled={job.status !== "waiting"}
            >
              <div><span>{job.reference}</span><span>{job.priority}</span></div>
              <h3>{job.title}</h3>
              <p>{job.zone} · {job.skill ?? "standard handling"}</p>
              <footer>
                {job.status === "delivered"
                  ? <span>{job.late ? "Delivered late" : "Delivered on time"}</span>
                  : job.status === "assigned"
                    ? <span>With {assignedDriver?.id ?? job.driverId} · ETA {formatTime(job.completeAt ?? state.time)}</span>
                    : <span className={remaining < 0 ? "sla-danger" : remaining <= 20 ? "sla-warn-text" : ""}>{dueCopy(job, state.time)}</span>}
                {job.status === "waiting" && <ChevronRight size={16} />}
              </footer>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Timeline({ state }: { state: GameState }) {
  const entries = [...state.log].sort((a, b) => b.at - a.at).slice(0, 8);
  return (
    <section className="timeline-panel">
      <header><div><span>Shift log</span><h2>What changed</h2></div><strong>{state.log.length} events</strong></header>
      <div className="timeline-list">
        {entries.map((entry, index) => (
          <article key={`${entry.at}-${index}`} className={entry.kind}>
            <time>{formatTime(entry.at)}</time><span>{entry.kind}</span><p>{entry.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionGuide({ state, selectedJob }: { state: GameState; selectedJob: GameJob | null }) {
  const waiting = state.jobs.filter((job) => job.releasedAt <= state.time && job.status === "waiting").length;
  const active = state.jobs.filter((job) => job.status === "assigned").length;
  const needsDriver = selectedJob?.status === "waiting";
  const hasMatch = state.jobs.some((job) => job.status === "waiting" && state.drivers.some((driver) => canAssign(state, job, driver).allowed));
  const step = needsDriver ? 2 : waiting > 0 && hasMatch ? 1 : 3;
  const title = needsDriver ? `Choose a driver for ${selectedJob.reference}` : waiting > 0 && hasMatch ? "Choose a waiting delivery" : "Advance the shift";
  const copy = needsDriver
    ? "The right-hand panel blocks drivers who lack the required skill or capacity."
    : waiting > 0 && hasMatch
      ? `${waiting} ${waiting === 1 ? "delivery is" : "deliveries are"} waiting. Select a card on the board or in the manifest.`
      : `${active} ${active === 1 ? "delivery is" : "deliveries are"} moving. Advance one turn to free capacity and see what changes.`;

  return (
    <section className="action-guide" aria-live="polite">
      <span className="action-step">Step {step} of 3</span>
      <div><strong>{title}</strong><p>{copy}</p></div>
      <div className="guide-dots" aria-hidden="true"><i className={step >= 1 ? "active" : ""} /><i className={step >= 2 ? "active" : ""} /><i className={step >= 3 ? "active" : ""} /></div>
    </section>
  );
}

function Game({ state, setState }: { state: GameState; setState: Dispatch<SetStateAction<GameState>> }) {
  const [showHelp, setShowHelp] = useState(false);
  const selectedJob = state.jobs.find((job) => job.id === state.selectedJobId) ?? null;
  const latestEvent = state.events.filter((event) => state.triggeredEventIds.includes(event.id)).at(-1);
  const progress = ((state.time - SHIFT_START) / (SHIFT_END - SHIFT_START)) * 100; // SOURCE: derived from the documented scenario bounds.

  const selectJob = (id: string | null) => setState((current) => ({ ...current, selectedJobId: id }));
  const assign = (driverId: string, source: "agent" | "manual") => {
    if (!selectedJob) return;
    setState((current) => assignJob(current, selectedJob.id, driverId, source));
    if (window.matchMedia("(max-width: 1150px)").matches) document.querySelector(".network-panel")?.scrollIntoView({ block: "start" });
  };
  const nextTime = formatTime(Math.min(SHIFT_END, state.time + TICK_MINUTES));

  return (
    <div className="game-shell">
      <header className="game-header">
        <span className="brand"><Route size={20} />DispatchOps</span>
        <div className="shift-clock"><Clock3 size={17} /><span>Current time</span><strong>{formatTime(state.time)}</strong></div>
        <div className="header-buttons">
          <button className="primary-control" onClick={() => setState((current) => advanceTime(current))}>
            <Play size={15} />Advance to {nextTime}
          </button>
          <button className="quiet" onClick={() => setShowHelp((current) => !current)}><HelpCircle size={15} />{showHelp ? "Hide help" : "How to play"}</button>
          <button className="quiet" onClick={() => setState((current) => finishShift(current))}><TimerReset size={15} />End shift</button>
        </div>
      </header>
      <div className="time-track"><span style={{ width: `${Math.min(100, progress)}%` }} /></div>

      {latestEvent && latestEvent.at === state.time && (
        <section className={`incident-banner ${latestEvent.kind}`} aria-live="assertive">
          <AlertTriangle size={20} />
          <div className="incident-body"><strong>{latestEvent.title}</strong><span>{latestEvent.detail}</span></div>
          <button type="button" onClick={() => selectJob(latestEvent.kind === "new-job" ? "J6" : state.jobs.find((job) => job.status === "waiting")?.id ?? null)}>
            Review queue <ArrowRight size={15} />
          </button>
        </section>
      )}

      <main className="game-main">
        <section className="mission-strip">
          <div><span>Objective</span><strong>Deliver every job before its target time.</strong></div>
          <p>This is a turn-based scenario. Assign as much work as you need, then advance the clock.</p>
        </section>

        {showHelp && <HowToPlay compact />}

        <section className="game-metrics" aria-label="Shift status">
          <article><ListChecks size={18} /><span>Waiting</span><strong>{state.jobs.filter((job) => job.releasedAt <= state.time && job.status === "waiting").length}</strong></article>
          <article><Truck size={18} /><span>Moving</span><strong>{state.jobs.filter((job) => job.status === "assigned").length}</strong></article>
          <article><PackageCheck size={18} /><span>Delivered</span><strong>{state.jobs.filter((job) => job.status === "delivered").length}</strong></article>
          <article><AlertTriangle size={18} /><span>Incidents</span><strong>{state.triggeredEventIds.length}</strong></article>
        </section>

        <ActionGuide state={state} selectedJob={selectedJob} />

        <section className="operations-grid">
          <NetworkMap state={state} selectJob={selectJob} />
          <DecisionDesk
            state={state}
            selectedJob={selectedJob}
            selectJob={selectJob}
            manualAssign={(driverId) => assign(driverId, "manual")}
            proposalAssign={(driverId) => assign(driverId, "agent")}
          />
        </section>

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
      <header className="debrief-nav"><span className="brand"><Route size={20} />DispatchOps</span><span>Shift debrief · {formatTime(state.time)}</span></header>
      <section className="debrief-summary">
        <div>
          <span>Shift result</span>
          <h1>{result.rating}</h1>
          <p>The score below is calculated from completed, late and blocked actions in this fictional scenario.</p>
        </div>
        <div className="score-card"><span>Game score</span><strong>{result.score}<small>/100</small></strong><p>Not an operational benchmark</p></div>
      </section>
      <section className="result-grid">
        <article><PackageCheck /><span>Completed</span><strong>{result.delivered}/{result.total}</strong></article>
        <article><Clock3 /><span>Within target</span><strong>{result.onTime}/{result.delivered}</strong></article>
        <article><Route /><span>Synthetic travel</span><strong>{result.travelMinutes} min</strong></article>
        <article><Users /><span>Suggested / manual</span><strong>{result.agentAccepted}/{result.manualAssignments}</strong></article>
      </section>
      <section className="debrief-body">
        <div className="decision-review">
          <span>Decision review</span>
          <h2>See exactly what happened.</h2>
          <p>{result.forcedReassignments ? `${result.forcedReassignments} assignment required replanning after the vehicle incident.` : "No active assignment was displaced by the vehicle incident."}</p>
          <button onClick={restart}><RefreshCw size={16} />Replay the same scenario</button>
        </div>
        <div className="full-log">
          {[...state.log].sort((a, b) => a.at - b.at).map((entry, index) => (
            <article key={`${entry.at}-${index}`}><time>{formatTime(entry.at)}</time><span>{entry.kind}</span><p>{entry.text}</p></article>
          ))}
        </div>
      </section>
      <footer className="debrief-footer"><ShieldCheck size={16} />Every driver, job, incident and travel time in this demo is synthetic.</footer>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState(createInitialGame);
  const screen = useMemo(() => state.phase, [state.phase]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [screen]);
  if (screen === "briefing") return <Briefing onStart={() => setState((current) => startGame(current))} />;
  if (screen === "complete") return <Debrief state={state} restart={() => setState(createInitialGame())} />;
  return <Game state={state} setState={setState} />;
}
