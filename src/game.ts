export type Zone = "Centrum" | "Noord" | "West" | "Zuid" | "Oost";
export type Skill = "cold-chain" | "fragile" | "bulky" | "same-day";
export type JobStatus = "waiting" | "assigned" | "delivered";
export type GamePhase = "briefing" | "playing" | "complete";

export interface GameDriver {
  id: string;
  name: string;
  zone: Zone;
  skills: Skill[];
  capacity: number;
  assigned: number;
  delivered: number;
  available: boolean;
  availableAt: number;
}

export interface GameJob {
  id: string;
  reference: string;
  title: string;
  zone: Zone;
  skill: Skill | null;
  priority: "urgent" | "high" | "normal";
  dueAt: number;
  releasedAt: number;
  status: JobStatus;
  driverId: string | null;
  completeAt: number | null;
  travelMinutes: number;
  late: boolean;
  originZone: Zone | null;
  beginsAt: number | null;
}

export interface GameEvent {
  id: string;
  at: number;
  title: string;
  detail: string;
  kind: "new-job" | "breakdown" | "closure";
}

export interface GameLog {
  at: number;
  kind: "assignment" | "delivery" | "incident" | "decision";
  text: string;
}

export interface AgentProposal {
  jobId: string;
  driverId: string;
  reasons: string[];
  travelMinutes: number;
}

export interface GameState {
  phase: GamePhase;
  time: number;
  selectedJobId: string | null;
  drivers: GameDriver[];
  jobs: GameJob[];
  events: GameEvent[];
  triggeredEventIds: string[];
  log: GameLog[];
  invalidAttempts: number;
  agentAccepted: number;
  manualAssignments: number;
  forcedReassignments: number;
}

export interface GameResult {
  score: number;
  rating: "Controlled" | "Stable" | "At risk";
  delivered: number;
  total: number;
  onTime: number;
  travelMinutes: number;
  agentAccepted: number;
  manualAssignments: number;
  forcedReassignments: number;
}

export const SHIFT_START = 9 * 60; // SOURCE: scenario briefing defines a 09:00 synthetic shift start.
export const SHIFT_END = 11 * 60 + 15; // GUESS: a 135-minute scenario keeps a recruiter playthrough short; tune with playtesting.
export const TICK_MINUTES = 15; // GUESS: 15-minute turns balance readable consequences with a short demo.
export const TICK_INTERVAL_MS = 22000; // GUESS: 22 seconds per synthetic 15-minute turn (9 turns ≈ 3.3 minutes total) gives recruiters enough time to read, match skills, and respond to incidents without rushing.
export const TICK_INTERVAL_FAST_MS = 7000; // GUESS: 7-second fast pace (9 turns ≈ 63 seconds) for quick replays or accelerated reviews.
const SERVICE_MINUTES = 10; // GUESS: uniform synthetic handling time used only by the game, not operational routing.

// GUESS: synthetic travel-time matrix chosen for gameplay trade-offs; these are not real Amsterdam routing times.
const travelMatrix: Record<Zone, Record<Zone, number>> = {
  Centrum: { Centrum: 8, Noord: 18, West: 14, Zuid: 17, Oost: 15 },
  Noord: { Centrum: 18, Noord: 8, West: 22, Zuid: 27, Oost: 19 },
  West: { Centrum: 14, Noord: 22, West: 8, Zuid: 18, Oost: 24 },
  Zuid: { Centrum: 17, Noord: 27, West: 18, Zuid: 8, Oost: 20 },
  Oost: { Centrum: 15, Noord: 19, West: 24, Zuid: 20, Oost: 8 },
};

const baseDrivers: GameDriver[] = [
  { id: "D1", name: "Driver 01", zone: "Centrum", skills: ["same-day", "fragile"], capacity: 2, assigned: 0, delivered: 0, available: true, availableAt: SHIFT_START },
  { id: "D2", name: "Driver 02", zone: "Noord", skills: ["cold-chain", "same-day"], capacity: 2, assigned: 0, delivered: 0, available: true, availableAt: SHIFT_START },
  { id: "D3", name: "Driver 03", zone: "West", skills: ["bulky", "fragile"], capacity: 2, assigned: 0, delivered: 0, available: true, availableAt: SHIFT_START },
  { id: "D4", name: "Driver 04", zone: "Oost", skills: ["cold-chain"], capacity: 2, assigned: 0, delivered: 0, available: true, availableAt: SHIFT_START },
]; // SOURCE: deterministic fictional game fixtures; identities are intentionally anonymized.

const baseJobs: GameJob[] = [
  createJob("J1", "DX-3101", "Clinical sample", "Centrum", "cold-chain", "urgent", 50),
  createJob("J2", "DX-3102", "Gallery parcel", "West", "fragile", "high", 75),
  createJob("J3", "DX-3103", "Retail stock", "Oost", null, "normal", 105),
  createJob("J4", "DX-3104", "Event equipment", "Zuid", "bulky", "high", 120),
  createJob("J5", "DX-3105", "Legal documents", "Noord", "same-day", "urgent", 65),
]; // SOURCE: deterministic synthetic manifest created for this portfolio simulation.

const scenarioEvents: GameEvent[] = [
  { id: "E1", at: SHIFT_START + 30, kind: "new-job", title: "Urgent request", detail: "A temperature-controlled healthcare transfer entered the queue." },
  { id: "E2", at: SHIFT_START + 45, kind: "breakdown", title: "Vehicle unavailable", detail: "Driver 02 reported a mechanical issue. Any unfinished work must be reassigned." },
  { id: "E3", at: SHIFT_START + 75, kind: "closure", title: "West corridor restricted", detail: "Active deliveries to West receive a synthetic 15-minute delay." },
]; // SOURCE: deterministic fictional incidents; they make every replay comparable.

function createJob(id: string, reference: string, title: string, zone: Zone, skill: Skill | null, priority: GameJob["priority"], dueOffset: number, releasedOffset = 0): GameJob {
  return { id, reference, title, zone, skill, priority, dueAt: SHIFT_START + dueOffset, releasedAt: SHIFT_START + releasedOffset, status: "waiting", driverId: null, completeAt: null, travelMinutes: 0, late: false, originZone: null, beginsAt: null };
}

export function createInitialGame(): GameState {
  return {
    phase: "briefing",
    time: SHIFT_START,
    selectedJobId: null,
    drivers: baseDrivers.map((driver) => ({ ...driver, skills: [...driver.skills] })),
    jobs: baseJobs.map((job) => ({ ...job })),
    events: scenarioEvents.map((event) => ({ ...event })),
    triggeredEventIds: [],
    log: [],
    invalidAttempts: 0,
    agentAccepted: 0,
    manualAssignments: 0,
    forcedReassignments: 0,
  };
}

export function startGame(state: GameState): GameState {
  return { ...state, phase: "playing", log: [{ at: state.time, kind: "decision", text: "Shift started. Five jobs are waiting for assignment." }] };
}

export function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function minutesToDue(job: GameJob, now: number): number {
  return job.dueAt - now;
}

export function canAssign(state: GameState, job: GameJob, driver: GameDriver): { allowed: boolean; reason: string } {
  if (state.phase !== "playing") return { allowed: false, reason: "The shift is not active." };
  if (job.status !== "waiting") return { allowed: false, reason: "This job is already assigned." };
  if (!driver.available) return { allowed: false, reason: "Driver is unavailable." };
  if (driver.assigned >= driver.capacity) return { allowed: false, reason: "Driver has reached scenario capacity." };
  if (job.skill && !driver.skills.includes(job.skill)) return { allowed: false, reason: `Requires ${job.skill}.` };
  return { allowed: true, reason: "Eligible" };
}

export function previewAssignment(state: GameState, job: GameJob, driver: GameDriver) {
  const queued = state.jobs.filter((item) => item.status === "assigned" && item.driverId === driver.id)
    .sort((a, b) => (a.completeAt ?? state.time) - (b.completeAt ?? state.time));
  const last = queued.at(-1);
  const originZone = last?.zone ?? driver.zone;
  const beginsAt = Math.max(state.time, last?.completeAt ?? state.time);
  // SOURCE: the West incident adds one scenario turn while the restriction is active.
  const delay = job.zone === "West" && state.triggeredEventIds.includes("E3") ? TICK_MINUTES : 0;
  const travelMinutes = travelMatrix[originZone][job.zone] + delay;
  return { originZone, beginsAt, travelMinutes, completeAt: beginsAt + travelMinutes + SERVICE_MINUTES };
}

export function proposeAssignment(state: GameState, jobId: string): AgentProposal | null {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job || job.status !== "waiting") return null;
  const candidates = state.drivers
    .filter((driver) => canAssign(state, job, driver).allowed)
    .map((driver) => ({ driver, plan: previewAssignment(state, job, driver) }))
    .sort((a, b) => a.plan.completeAt - b.plan.completeAt || a.driver.assigned - b.driver.assigned || a.driver.id.localeCompare(b.driver.id));
  const selected = candidates[0];
  if (!selected) return null;
  const reasons = [
    job.skill ? `Certified for ${job.skill}` : "No specialist handling required",
    `${selected.plan.travelMinutes} synthetic travel minutes from ${selected.plan.originZone}`,
    `Arrival ${formatTime(selected.plan.completeAt)}${selected.plan.completeAt > job.dueAt ? " — past target" : " — within target"}`,
    `${selected.driver.capacity - selected.driver.assigned} capacity slot${selected.driver.capacity - selected.driver.assigned === 1 ? "" : "s"} remaining`,
  ];
  return { jobId, driverId: selected.driver.id, reasons, travelMinutes: selected.plan.travelMinutes };
}

export function assignJob(state: GameState, jobId: string, driverId: string, source: "agent" | "manual"): GameState {
  const job = state.jobs.find((item) => item.id === jobId);
  const driver = state.drivers.find((item) => item.id === driverId);
  if (!job || !driver) return { ...state, invalidAttempts: state.invalidAttempts + 1 };
  const eligibility = canAssign(state, job, driver);
  if (!eligibility.allowed) {
    return { ...state, invalidAttempts: state.invalidAttempts + 1, log: [...state.log, { at: state.time, kind: "decision", text: `${job.reference} was not assigned: ${eligibility.reason}` }] };
  }
  const { travelMinutes, beginsAt, completeAt, originZone } = previewAssignment(state, job, driver);
  return {
    ...state,
    selectedJobId: null,
    agentAccepted: state.agentAccepted + (source === "agent" ? 1 : 0),
    manualAssignments: state.manualAssignments + (source === "manual" ? 1 : 0),
    jobs: state.jobs.map((item) => item.id === jobId ? { ...item, status: "assigned", driverId, completeAt, travelMinutes, beginsAt, originZone } : item),
    drivers: state.drivers.map((item) => item.id === driverId ? { ...item, assigned: item.assigned + 1, availableAt: completeAt } : item),
    log: [...state.log, { at: state.time, kind: "assignment", text: `${job.reference} assigned to ${driver.name}${source === "agent" ? " using the suggested match" : " manually"}. Arrival ${formatTime(completeAt)}.` }],
  };
}

function deliverCompleted(state: GameState, nextTime: number): GameState {
  const completed = state.jobs.filter((job) => job.status === "assigned" && job.completeAt !== null && job.completeAt <= nextTime);
  if (!completed.length) return state;
  const completedIds = new Set(completed.map((job) => job.id));
  const drivers = state.drivers.map((driver) => {
    const driverJobs = completed.filter((job) => job.driverId === driver.id);
    if (!driverJobs.length) return driver;
    const last = [...driverJobs].sort((a, b) => (a.completeAt ?? 0) - (b.completeAt ?? 0)).at(-1)!;
    return { ...driver, assigned: Math.max(0, driver.assigned - driverJobs.length), delivered: driver.delivered + driverJobs.length, zone: last.zone };
  });
  return {
    ...state,
    drivers,
    jobs: state.jobs.map((job) => completedIds.has(job.id) ? { ...job, status: "delivered", late: (job.completeAt ?? nextTime) > job.dueAt } : job),
    log: [...state.log, ...completed.map((job) => ({ at: job.completeAt ?? nextTime, kind: "delivery" as const, text: `${job.reference} delivered${(job.completeAt ?? nextTime) > job.dueAt ? " after its target" : " on time"}.` }))],
  };
}

function triggerEvent(state: GameState, event: GameEvent): GameState {
  let next = { ...state, triggeredEventIds: [...state.triggeredEventIds, event.id], log: [...state.log, { at: event.at, kind: "incident" as const, text: `${event.title}: ${event.detail}` }] };
  if (event.kind === "new-job") {
    const urgent = createJob("J6", "DX-3106", "Healthcare transfer", "Centrum", "cold-chain", "urgent", 80, 30); // SOURCE: tied to deterministic event E1.
    next = { ...next, jobs: [...next.jobs, urgent] };
  }
  if (event.kind === "breakdown") {
    const affected = next.jobs.filter((job) => job.driverId === "D2" && job.status === "assigned");
    next = {
      ...next,
      forcedReassignments: next.forcedReassignments + affected.length,
      drivers: next.drivers.map((driver) => driver.id === "D2" ? { ...driver, available: false, assigned: 0 } : driver),
      jobs: next.jobs.map((job) => job.driverId === "D2" && job.status === "assigned" ? { ...job, status: "waiting", driverId: null, completeAt: null, travelMinutes: 0, beginsAt: null, originZone: null } : job),
    };
  }
  if (event.kind === "closure") {
    const closureDelay = 15; // GUESS: one game turn makes the incident visible without claiming a real traffic delay.
    const jobs = next.jobs.map((job) => ({ ...job }));
    const drivers = next.drivers.map((driver) => {
      let delay = 0; // SOURCE: no delay until this driver's queued work reaches the restricted zone.
      for (const job of jobs.filter((item) => item.driverId === driver.id && item.status === "assigned").sort((a, b) => (a.completeAt ?? 0) - (b.completeAt ?? 0))) {
        if (job.beginsAt !== null && job.beginsAt >= event.at) job.beginsAt += delay;
        if (job.zone === "West") { delay += closureDelay; job.travelMinutes += closureDelay; }
        if (job.completeAt !== null) job.completeAt += delay;
      }
      return { ...driver, availableAt: driver.availableAt + delay };
    });
    next = { ...next, jobs, drivers };
  }
  return next;
}

export function advanceTime(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const nextTime = Math.min(SHIFT_END, state.time + TICK_MINUTES);
  let next = state;
  const dueEvents = next.events.filter((event) => event.at > state.time && event.at <= nextTime && !next.triggeredEventIds.includes(event.id));
  for (const event of dueEvents.sort((a, b) => a.at - b.at)) {
    next = deliverCompleted(next, event.at);
    next = triggerEvent(next, event);
  }
  next = deliverCompleted(next, nextTime);
  next = { ...next, time: nextTime };
  if (nextTime >= SHIFT_END || (next.triggeredEventIds.length === next.events.length && next.jobs.every((job) => job.status === "delivered"))) return { ...next, phase: "complete" };
  return next;
}

export function finishShift(state: GameState): GameState {
  return state.phase === "playing" ? { ...state, phase: "complete" } : state;
}

export function gameResult(state: GameState): GameResult {
  const delivered = state.jobs.filter((job) => job.status === "delivered");
  const onTime = delivered.filter((job) => !job.late).length;
  const incomplete = state.jobs.length - delivered.length;
  const late = delivered.length - onTime;
  const incompletePenalty = 22; // GUESS: game scoring weight; visible as synthetic and requires playtest calibration.
  const latePenalty = 12; // GUESS: game scoring weight; visible as synthetic and requires playtest calibration.
  const invalidPenalty = 4; // GUESS: small penalty for blocked decisions; requires playtest calibration.
  const score = Math.max(0, 100 - incomplete * incompletePenalty - late * latePenalty - state.invalidAttempts * invalidPenalty);
  const controlledThreshold = 90; // GUESS: game rating boundary, not an operational benchmark.
  const stableThreshold = 65; // GUESS: game rating boundary, not an operational benchmark.
  return {
    score,
    rating: score >= controlledThreshold ? "Controlled" : score >= stableThreshold ? "Stable" : "At risk",
    delivered: delivered.length,
    total: state.jobs.length,
    onTime,
    travelMinutes: delivered.reduce((sum, job) => sum + job.travelMinutes, 0),
    agentAccepted: state.agentAccepted,
    manualAssignments: state.manualAssignments,
    forcedReassignments: state.forcedReassignments,
  };
}
