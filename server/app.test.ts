import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { DispatchDatabase } from "./db.js";

describe("DispatchOps API", () => {
  let db: DispatchDatabase;
  let application: ReturnType<typeof createApp>;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-only-secret"; // SOURCE: isolated test secret; never used outside the test process.
    db = new DispatchDatabase(":memory:");
    application = createApp(db);
  });

  afterEach(() => db.close());

  it("reports service health without authentication", async () => {
    const response = await request(application.app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "dispatchops" });
  });

  it("rejects invalid credentials", async () => {
    const response = await request(application.app).post("/api/auth/login").send({
      email: "dispatcher@dispatchops.local",
      password: "incorrect-password",
    });
    expect(response.status).toBe(401);
  });

  it("returns the live overview to an authenticated dispatcher", async () => {
    const agent = request.agent(application.app);
    await agent.post("/api/auth/login").send({ email: "dispatcher@dispatchops.local", password: "dispatch123" }).expect(200);
    const response = await agent.get("/api/overview").expect(200);
    expect(response.body.totals.openJobs).toBe(7);
    expect(response.body.jobs).toHaveLength(8);
    expect(response.body.drivers).toHaveLength(5);
  });

  it("enforces read-only viewer permissions", async () => {
    const agent = request.agent(application.app);
    await agent.post("/api/auth/login").send({ email: "viewer@dispatchops.local", password: "viewer123" }).expect(200);
    await agent.post("/api/agent/run").expect(403);
  });

  it("creates explainable proposals and applies only an approved assignment", async () => {
    const agent = request.agent(application.app);
    await agent.post("/api/auth/login").send({ email: "dispatcher@dispatchops.local", password: "dispatch123" }).expect(200);
    const analysis = await agent.post("/api/agent/run").expect(200);
    expect(analysis.body.mode).toBe("deterministic-human-in-the-loop");
    expect(analysis.body.recommendations.length).toBeGreaterThan(0);
    expect(analysis.body.recommendations[0].rationale.length).toBeGreaterThan(0);

    const proposal = analysis.body.recommendations[0] as { id: number; job_id: number; driver_id: number };
    expect(db.getJob(proposal.job_id)?.status).toBe("unassigned");
    const approval = await agent.post(`/api/recommendations/${proposal.id}/approve`).expect(200);
    expect(approval.body.recommendation.status).toBe("approved");
    expect(db.getJob(proposal.job_id)?.driver_id).toBe(proposal.driver_id);
    expect(db.getJob(proposal.job_id)?.status).toBe("assigned");
  });
});
