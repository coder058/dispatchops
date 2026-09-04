import { describe, expect, it } from "vitest";
import {
  SHIFT_END,
  TICK_INTERVAL_FAST_MS,
  TICK_INTERVAL_MS,
  TICK_MINUTES,
  advanceTime,
  assignJob,
  canAssign,
  createInitialGame,
  formatTime,
  gameResult,
  minutesToDue,
  proposeAssignment,
  startGame,
} from "./game";

describe("DispatchOps game engine", () => {
  it("starts from the same synthetic manifest on every replay", () => {
    const first = createInitialGame();
    const second = createInitialGame();
    expect(first).toEqual(second);
    expect(first.jobs).toHaveLength(5);
    expect(first.phase).toBe("briefing");
  });

  it("configures readable pacing constants for the 3-5 minute recruiter target", () => {
    const totalSyntheticMinutes = SHIFT_END - 9 * 60; // 135 minutes
    const totalTicks = totalSyntheticMinutes / TICK_MINUTES; // 9 turns
    expect(totalTicks).toBe(9);
    
    // Normal pace gives ~3.3 minutes total shift time
    const normalTotalSeconds = (totalTicks * TICK_INTERVAL_MS) / 1000;
    expect(normalTotalSeconds).toBeGreaterThanOrEqual(180); // >= 3 minutes
    expect(normalTotalSeconds).toBeLessThanOrEqual(300); // <= 5 minutes
    
    // Fast pace gives ~1 minute accelerated review
    const fastTotalSeconds = (totalTicks * TICK_INTERVAL_FAST_MS) / 1000;
    expect(fastTotalSeconds).toBe(63);
  });

  it("proposes an eligible driver with transparent reasons", () => {
    const state = startGame(createInitialGame());
    const proposal = proposeAssignment(state, "J1");
    expect(proposal?.driverId).toBe("D4");
    expect(proposal?.reasons).toContain("Certified for cold-chain");
    expect(proposal?.reasons.some((reason) => reason.includes("synthetic travel minutes"))).toBe(true);
  });

  it("evaluates driver eligibility strictly against required skill certificates", () => {
    const state = startGame(createInitialGame());
    const j1 = state.jobs.find((j) => j.id === "J1")!; // requires cold-chain
    const d1 = state.drivers.find((d) => d.id === "D1")!; // same-day, fragile
    const d4 = state.drivers.find((d) => d.id === "D4")!; // cold-chain
    
    expect(canAssign(state, j1, d1).allowed).toBe(false);
    expect(canAssign(state, j1, d4).allowed).toBe(true);
  });

  it("blocks a manual assignment when the required skill is missing", () => {
    const state = startGame(createInitialGame());
    const next = assignJob(state, "J1", "D1", "manual");
    expect(next.jobs.find((job) => job.id === "J1")?.status).toBe("waiting");
    expect(next.invalidAttempts).toBe(1);
  });

  it("formats time and computes minutes to due cleanly", () => {
    expect(formatTime(540)).toBe("09:00");
    expect(formatTime(675)).toBe("11:15");

    const state = createInitialGame();
    const j1 = state.jobs.find((j) => j.id === "J1")!;
    expect(minutesToDue(j1, 540)).toBe(50);
  });

  it("releases the urgent job at the deterministic incident time", () => {
    let state = startGame(createInitialGame());
    state = advanceTime(state);
    state = advanceTime(state);
    expect(state.time).toBe(570);
    expect(state.jobs.find((job) => job.id === "J6")?.reference).toBe("DX-3106");
    expect(state.triggeredEventIds).toContain("E1");
  });

  it("requeues unfinished Driver 02 work when the vehicle fails", () => {
    let state = startGame(createInitialGame());
    state = advanceTime(state);
    state = advanceTime(state);
    state = assignJob(state, "J3", "D2", "manual");
    state = advanceTime(state);
    expect(state.time).toBe(585);
    expect(state.drivers.find((driver) => driver.id === "D2")?.available).toBe(false);
    expect(state.jobs.find((job) => job.id === "J3")?.status).toBe("waiting");
    expect(state.forcedReassignments).toBe(1);
  });

  it("derives the debrief only from recorded outcomes", () => {
    const state = startGame(createInitialGame());
    const result = gameResult(state);
    expect(result.delivered).toBe(0);
    expect(result.total).toBe(5);
    expect(result.score).toBe(0);
    expect(result.rating).toBe("At risk");
  });
});
