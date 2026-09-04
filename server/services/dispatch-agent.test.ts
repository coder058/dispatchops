import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DispatchDatabase } from "../db.js";
import { DispatchAgent } from "./dispatch-agent.js";

describe("DispatchAgent", () => {
  let db: DispatchDatabase;
  let agent: DispatchAgent;

  beforeEach(() => {
    db = new DispatchDatabase(":memory:");
    agent = new DispatchAgent(db);
  });

  afterEach(() => db.close());

  it("prefers an available same-region driver with the required skill", () => {
    const proposals = agent.run();
    const urgent = proposals.find((proposal) => proposal.job_reference === "DX-2048");
    expect(urgent?.driver_name).toBe("Driver 01");
    expect(urgent?.rationale).toContain("Already operating in Centrum");
    expect(urgent?.rationale).toContain("Certified for same-day");
  });

  it("does not mutate a job while a recommendation is pending", () => {
    const [proposal] = agent.run();
    expect(proposal).toBeDefined();
    expect(db.getJob(proposal.job_id)?.status).toBe("unassigned");
  });
});
