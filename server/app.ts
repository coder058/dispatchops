import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { comparePassword, clearSession, issueSession, requireAuth, requireRole } from "./auth.js";
import { DispatchDatabase } from "./db.js";
import { EventHub } from "./events.js";
import { DispatchAgent } from "./services/dispatch-agent.js";

const loginSchema = z.object({
  email: z.string().email().max(160), // SOURCE: conservative RFC-compatible application boundary.
  password: z.string().min(8).max(128), // SOURCE: OWASP-compatible application boundary; demo passwords meet it.
});

const jobUpdateSchema = z.object({
  status: z.enum(["unassigned", "assigned", "in_transit", "delivered", "exception"]),
  driverId: z.number().int().positive().nullable(),
  etaMinutes: z.number().int().nonnegative().max(1_440).nullable(), // SOURCE: bounded to one day for this same-day dispatch domain.
});

export interface AppServices {
  db: DispatchDatabase;
  events: EventHub;
  agent: DispatchAgent;
}

export function createApp(database?: DispatchDatabase) {
  const db = database ?? new DispatchDatabase();
  const events = new EventHub();
  const agent = new DispatchAgent(db);
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "100kb" })); // SOURCE: API accepts small structured commands, never file uploads.

  const loginWindowMs = 15 * 60 * 1000; // SOURCE: 15-minute login-rate window, a common operational security interval.
  const loginLimit = 20; // GUESS: suitable for a local demo and small team; calibrate using production traffic and threat data.
  const loginLimiter = rateLimit({ windowMs: loginWindowMs, limit: loginLimit, standardHeaders: "draft-8", legacyHeaders: false });

  app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "dispatchops" }));

  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid login payload" });
    const user = db.findUserByEmail(parsed.data.email.toLowerCase());
    if (!user || !comparePassword(parsed.data.password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    issueSession(res, sessionUser);
    return res.json({ user: sessionUser });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSession(res);
    res.status(204).end();
  });

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));
  app.get("/api/overview", requireAuth, (_req, res) => res.json(db.overview()));
  app.get("/api/jobs", requireAuth, (_req, res) => res.json({ jobs: db.listJobs() }));
  app.get("/api/drivers", requireAuth, (_req, res) => res.json({ drivers: db.listDrivers() }));
  app.get("/api/alerts", requireAuth, (_req, res) => res.json({ alerts: db.listAlerts() }));
  app.get("/api/recommendations", requireAuth, (_req, res) => res.json({ recommendations: db.listRecommendations() }));

  app.patch("/api/jobs/:id", requireAuth, requireRole("dispatcher"), (req, res) => {
    const parsed = jobUpdateSchema.safeParse(req.body);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !parsed.success) return res.status(400).json({ error: "Invalid job update" });
    if (parsed.data.driverId && !db.getDriver(parsed.data.driverId)) return res.status(404).json({ error: "Driver not found" });
    const job = db.updateJob(id, parsed.data.status, parsed.data.driverId, parsed.data.etaMinutes);
    if (!job) return res.status(404).json({ error: "Job not found" });
    events.publish("job.updated", job);
    return res.json({ job });
  });

  app.post("/api/alerts/:id/resolve", requireAuth, requireRole("dispatcher"), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid alert id" });
    const alert = db.resolveAlert(id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    events.publish("alert.resolved", alert);
    return res.json({ alert });
  });

  app.post("/api/agent/run", requireAuth, requireRole("dispatcher"), (_req, res) => {
    const recommendations = agent.run();
    events.publish("agent.completed", { count: recommendations.length });
    return res.json({ recommendations, mode: "deterministic-human-in-the-loop" });
  });

  app.post("/api/recommendations/:id/approve", requireAuth, requireRole("dispatcher"), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid recommendation id" });
    const recommendation = agent.approve(id);
    if (!recommendation) return res.status(409).json({ error: "Recommendation is stale or no longer applicable" });
    events.publish("recommendation.updated", recommendation);
    return res.json({ recommendation, overview: db.overview() });
  });

  app.post("/api/recommendations/:id/dismiss", requireAuth, requireRole("dispatcher"), (req, res) => {
    const id = Number(req.params.id);
    const recommendation = db.getRecommendation(id);
    if (!recommendation || recommendation.status !== "pending") return res.status(404).json({ error: "Pending recommendation not found" });
    db.setRecommendationStatus(id, "dismissed");
    events.publish("recommendation.updated", { ...recommendation, status: "dismissed" });
    return res.status(204).end();
  });

  app.get("/api/events", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const remove = events.add(res);
    req.on("close", remove);
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    console.error(error);
    res.status(500).json({ error: "Unexpected server error" });
  });

  return { app, services: { db, events, agent } satisfies AppServices };
}
