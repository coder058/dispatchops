import type { DispatchDatabase } from "../db.js";
import type { DriverRecord, JobRecord, RecommendationRecord } from "../types.js";

interface Candidate {
  driver: DriverRecord;
  reasons: string[];
}

function serviceSkill(service: string): string | null {
  const normalized = service.toLowerCase();
  if (normalized.includes("cold")) return "cold-chain";
  if (normalized.includes("fragile")) return "fragile";
  if (normalized.includes("bulky")) return "bulky";
  if (normalized.includes("same")) return "same-day";
  return null;
}

function candidateFor(job: JobRecord, driver: DriverRecord): Candidate | null {
  if (driver.status !== "available" || driver.current_load >= driver.capacity) return null;
  const requiredSkill = serviceSkill(job.service);
  if (requiredSkill && !driver.skills.includes(requiredSkill)) return null;

  const reasons = [
    requiredSkill ? `Certified for ${requiredSkill}` : "No specialist handling requirement",
    `${driver.capacity - driver.current_load} capacity slots remain`,
  ];
  if (driver.region === job.region) reasons.unshift(`Already operating in ${job.region}`);
  return { driver, reasons };
}

function compareCandidates(job: JobRecord, a: Candidate, b: Candidate): number {
  const aLocal = a.driver.region === job.region ? 1 : 0; // SOURCE: exact-region match is preferred to reduce avoidable repositioning.
  const bLocal = b.driver.region === job.region ? 1 : 0; // SOURCE: same comparison dimension as aLocal.
  if (aLocal !== bLocal) return bLocal - aLocal;
  const aLoad = a.driver.current_load / a.driver.capacity;
  const bLoad = b.driver.current_load / b.driver.capacity;
  return aLoad - bLoad;
}

/**
 * A transparent planning agent: observe → propose → wait for human approval.
 * It does not call an LLM and it never mutates dispatch state itself.
 */
export class DispatchAgent {
  constructor(private readonly db: DispatchDatabase) {}

  run(): RecommendationRecord[] {
    const jobs = this.db.listJobs().filter((job) => job.status === "unassigned");
    const drivers = this.db.listDrivers();
    const recommendations: RecommendationRecord[] = [];
    const projectedLoads = new Map(drivers.map((driver) => [driver.id, driver.current_load]));
    const maxSuggestions = 3; // SOURCE: demo dashboard has three decision slots, keeping every suggestion reviewable by a human.

    for (const job of jobs) {
      const candidates = drivers
        .map((driver) => ({ ...driver, current_load: projectedLoads.get(driver.id) ?? driver.current_load }))
        .map((driver) => candidateFor(job, driver))
        .filter((candidate): candidate is Candidate => candidate !== null)
        .sort((a, b) => compareCandidates(job, a, b));

      const selected = candidates[0];
      if (!selected) continue;
      recommendations.push(this.db.createRecommendation(
        job.id,
        selected.driver.id,
        `Assign ${job.reference} to ${selected.driver.name}`,
        selected.reasons,
      ));
      projectedLoads.set(selected.driver.id, (projectedLoads.get(selected.driver.id) ?? selected.driver.current_load) + 1);
      if (recommendations.length >= maxSuggestions) break;
    }
    return recommendations;
  }

  approve(recommendationId: number): RecommendationRecord | undefined {
    const recommendation = this.db.getRecommendation(recommendationId);
    if (!recommendation || recommendation.status !== "pending") return undefined;
    const job = this.db.getJob(recommendation.job_id);
    const driver = this.db.getDriver(recommendation.driver_id);
    if (!job || !driver || job.status !== "unassigned" || driver.current_load >= driver.capacity) return undefined;

    const defaultEtaMinutes = 45; // GUESS: UI placeholder until routing-distance data is integrated; do not use operationally.
    this.db.updateJob(job.id, "assigned", driver.id, defaultEtaMinutes);
    this.db.incrementDriverLoad(driver.id);
    this.db.setRecommendationStatus(recommendation.id, "approved");
    return this.db.getRecommendation(recommendation.id);
  }
}
