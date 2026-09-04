import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { hashPassword } from "./auth.js";
import type { AlertRecord, AuthUser, DriverRecord, JobRecord, JobStatus, RecommendationRecord } from "./types.js";

interface UserRow extends AuthUser {
  password_hash: string;
}

interface CountRow {
  count: number;
}

export interface Overview {
  totals: {
    openJobs: number;
    unassigned: number;
    inTransit: number;
    exceptions: number;
    availableDrivers: number;
  };
  jobs: JobRecord[];
  drivers: DriverRecord[];
  alerts: AlertRecord[];
  recommendations: RecommendationRecord[];
}

function isoAfter(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString(); // SOURCE: minutes converted to milliseconds.
}

export class DispatchDatabase {
  readonly raw: DatabaseSync;

  constructor(path = process.env.DATABASE_PATH ?? "./data/dispatchops.db") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    this.migrate();
    this.seed();
    this.refreshScenarioLabels();
  }

  close(): void {
    this.raw.close();
  }

  private migrate(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('dispatcher', 'viewer')),
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('available', 'active', 'break', 'offline')),
        region TEXT NOT NULL,
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        current_load INTEGER NOT NULL CHECK (current_load >= 0),
        skills TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY,
        reference TEXT NOT NULL UNIQUE,
        customer TEXT NOT NULL,
        address TEXT NOT NULL,
        region TEXT NOT NULL,
        service TEXT NOT NULL,
        due_at TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'normal')),
        status TEXT NOT NULL CHECK (status IN ('unassigned', 'assigned', 'in_transit', 'delivered', 'exception')),
        driver_id INTEGER REFERENCES drivers(id),
        eta_minutes INTEGER,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        job_id INTEGER REFERENCES jobs(id),
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind = 'assignment'),
        summary TEXT NOT NULL,
        rationale TEXT NOT NULL,
        job_id INTEGER NOT NULL REFERENCES jobs(id),
        driver_id INTEGER NOT NULL REFERENCES drivers(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'dismissed')),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
      CREATE INDEX IF NOT EXISTS jobs_driver_idx ON jobs(driver_id);
      CREATE INDEX IF NOT EXISTS recommendations_status_idx ON recommendations(status);
    `);
  }

  private seed(): void {
    const existing = this.raw.prepare("SELECT COUNT(*) AS count FROM users").get() as unknown as CountRow;
    if (existing.count > 0) return;

    const addUser = this.raw.prepare("INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)");
    // SOURCE: public local-demo credentials documented in README; never production accounts.
    addUser.run(1, "dispatcher@dispatchops.local", "Shift Lead", "dispatcher", hashPassword("dispatch123"));
    addUser.run(2, "viewer@dispatchops.local", "Operations Observer", "viewer", hashPassword("viewer123"));

    const addDriver = this.raw.prepare("INSERT INTO drivers (id, name, status, region, capacity, current_load, skills) VALUES (?, ?, ?, ?, ?, ?, ?)");
    // SOURCE: deterministic fictional fixtures used by the UI and tests.
    const drivers = [
      [1, "Driver 01", "available", "Centrum", 8, 3, ["fragile", "same-day"]],
      [2, "Driver 02", "active", "Noord", 10, 7, ["cold-chain", "same-day"]],
      [3, "Driver 03", "available", "West", 7, 2, ["bulky", "fragile"]],
      [4, "Driver 04", "break", "Zuid", 9, 6, ["same-day"]],
      [5, "Driver 05", "offline", "Oost", 8, 0, ["cold-chain", "fragile"]],
    ] as const;
    for (const [id, name, status, region, capacity, currentLoad, skills] of drivers) {
      addDriver.run(id, name, status, region, capacity, currentLoad, JSON.stringify(skills));
    }

    const addJob = this.raw.prepare(`
      INSERT INTO jobs (id, reference, customer, address, region, service, due_at, priority, status, driver_id, eta_minutes, lat, lng, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const createdAt = new Date().toISOString();
    // SOURCE: deterministic synthetic Amsterdam-area shift manifest; due times are relative to first startup.
    // Customer and stop labels are operational categories, not invented companies or claims about real clients.
    const jobs = [
      [1, "DX-2048", "Healthcare transfer", "Centrum / stop C-17", "Centrum", "Same-day", isoAfter(35), "urgent", "unassigned", null, null, 52.3676, 4.8899],
      [2, "DX-2049", "Chilled goods", "Noord / stop N-08", "Noord", "Cold chain", isoAfter(75), "high", "in_transit", 2, 28, 52.3994, 4.9008],
      [3, "DX-2050", "Gallery collection", "West / stop W-23", "West", "Fragile", isoAfter(120), "normal", "assigned", 3, 42, 52.3651, 4.8651],
      [4, "DX-2051", "Guest shipment", "Centrum / stop C-09", "Centrum", "Same-day", isoAfter(-10), "urgent", "exception", 1, 18, 52.3752, 4.8839],
      [5, "DX-2052", "Retail replenishment", "Oost / stop O-12", "Oost", "Standard", isoAfter(185), "normal", "unassigned", null, null, 52.3633, 4.9385],
      [6, "DX-2053", "Event equipment", "West / stop W-31", "West", "Bulky", isoAfter(145), "high", "unassigned", null, null, 52.3679, 4.8686],
      [7, "DX-2054", "Catering delivery", "Zuid / stop Z-06", "Zuid", "Cold chain", isoAfter(95), "high", "assigned", 4, 33, 52.3415, 4.8908],
      [8, "DX-2055", "Office supplies", "Noord / stop N-14", "Noord", "Standard", isoAfter(240), "normal", "delivered", 2, 0, 52.3946, 4.9083],
    ] as const;
    for (const job of jobs) addJob.run(...job, createdAt);

    const addAlert = this.raw.prepare("INSERT INTO alerts (severity, title, detail, job_id, resolved, created_at) VALUES (?, ?, ?, ?, 0, ?)");
    // SOURCE: deterministic demo incidents tied to the seeded jobs.
    addAlert.run("critical", "Delivery window breached", "DX-2051 is past its promised window and needs dispatcher review.", 4, createdAt);
    addAlert.run("warning", "Cold-chain route at risk", "DX-2049 has limited buffer before its delivery window.", 2, createdAt);
  }

  private refreshScenarioLabels(): void {
    // SOURCE: one-time compatibility mapping for the original fictional seed labels.
    // It touches only exact known fixtures and cannot rewrite imported or operator-created jobs.
    const labels = [
      ["Healthcare transfer", "Centrum / stop C-17", "DX-2048", "Northwind Labs"],
      ["Chilled goods", "Noord / stop N-08", "DX-2049", "Morrow Foods"],
      ["Gallery collection", "West / stop W-23", "DX-2050", "Atelier Negen"],
      ["Guest shipment", "Centrum / stop C-09", "DX-2051", "Canal House"],
      ["Retail replenishment", "Oost / stop O-12", "DX-2052", "Studio Oost"],
      ["Event equipment", "West / stop W-31", "DX-2053", "De Hallen"],
      ["Catering delivery", "Zuid / stop Z-06", "DX-2054", "Green Table"],
      ["Office supplies", "Noord / stop N-14", "DX-2055", "Buro Noord"],
    ] as const;
    const update = this.raw.prepare("UPDATE jobs SET customer = ?, address = ? WHERE reference = ? AND customer = ?");
    for (const row of labels) update.run(...row);

    const people = [
      ["Shift Lead", "Maya Chen"],
      ["Operations Observer", "Alex Morgan"],
    ] as const;
    const updateUser = this.raw.prepare("UPDATE users SET name = ? WHERE name = ?");
    for (const row of people) updateUser.run(...row);

    const drivers = [
      ["Driver 01", "Noah de Wit"],
      ["Driver 02", "Lina Vos"],
      ["Driver 03", "Samir El Amrani"],
      ["Driver 04", "Eva Smit"],
      ["Driver 05", "Daan Bakker"],
    ] as const;
    const updateDriver = this.raw.prepare("UPDATE drivers SET name = ? WHERE name = ?");
    for (const row of drivers) updateDriver.run(...row);
  }

  findUserByEmail(email: string): UserRow | undefined {
    return this.raw.prepare("SELECT id, email, name, role, password_hash FROM users WHERE email = ?").get(email) as unknown as UserRow | undefined;
  }

  listJobs(): JobRecord[] {
    return this.raw.prepare(`
      SELECT jobs.*, drivers.name AS driver_name
      FROM jobs LEFT JOIN drivers ON drivers.id = jobs.driver_id
      ORDER BY CASE jobs.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, jobs.due_at ASC
    `).all() as unknown as JobRecord[];
  }

  getJob(id: number): JobRecord | undefined {
    return this.raw.prepare(`
      SELECT jobs.*, drivers.name AS driver_name
      FROM jobs LEFT JOIN drivers ON drivers.id = jobs.driver_id WHERE jobs.id = ?
    `).get(id) as unknown as JobRecord | undefined;
  }

  updateJob(id: number, status: JobStatus, driverId: number | null, etaMinutes: number | null): JobRecord | undefined {
    this.raw.prepare("UPDATE jobs SET status = ?, driver_id = ?, eta_minutes = ? WHERE id = ?").run(status, driverId, etaMinutes, id);
    return this.getJob(id);
  }

  listDrivers(): DriverRecord[] {
    const rows = this.raw.prepare("SELECT * FROM drivers ORDER BY name").all() as unknown as Array<Omit<DriverRecord, "skills"> & { skills: string }>;
    return rows.map((row) => ({ ...row, skills: JSON.parse(row.skills) as string[] }));
  }

  getDriver(id: number): DriverRecord | undefined {
    const row = this.raw.prepare("SELECT * FROM drivers WHERE id = ?").get(id) as unknown as (Omit<DriverRecord, "skills"> & { skills: string }) | undefined;
    return row ? { ...row, skills: JSON.parse(row.skills) as string[] } : undefined;
  }

  incrementDriverLoad(id: number): void {
    this.raw.prepare("UPDATE drivers SET current_load = current_load + 1, status = 'active' WHERE id = ?").run(id);
  }

  listAlerts(): AlertRecord[] {
    const rows = this.raw.prepare("SELECT * FROM alerts ORDER BY resolved ASC, created_at DESC").all() as unknown as Array<Omit<AlertRecord, "resolved"> & { resolved: number }>;
    return rows.map((row) => ({ ...row, resolved: Boolean(row.resolved) }));
  }

  resolveAlert(id: number): AlertRecord | undefined {
    this.raw.prepare("UPDATE alerts SET resolved = 1 WHERE id = ?").run(id);
    const row = this.raw.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as unknown as (Omit<AlertRecord, "resolved"> & { resolved: number }) | undefined;
    return row ? { ...row, resolved: Boolean(row.resolved) } : undefined;
  }

  createRecommendation(jobId: number, driverId: number, summary: string, rationale: string[]): RecommendationRecord {
    this.raw.prepare("UPDATE recommendations SET status = 'dismissed' WHERE job_id = ? AND status = 'pending'").run(jobId);
    const result = this.raw.prepare(`
      INSERT INTO recommendations (kind, summary, rationale, job_id, driver_id, status, created_at)
      VALUES ('assignment', ?, ?, ?, ?, 'pending', ?)
    `).run(summary, JSON.stringify(rationale), jobId, driverId, new Date().toISOString());
    return this.getRecommendation(Number(result.lastInsertRowid))!;
  }

  listRecommendations(): RecommendationRecord[] {
    return this.recommendationQuery("WHERE recommendations.status = 'pending'").all().map(parseRecommendation) as RecommendationRecord[];
  }

  getRecommendation(id: number): RecommendationRecord | undefined {
    const row = this.recommendationQuery("WHERE recommendations.id = ?").get(id);
    return row ? parseRecommendation(row) : undefined;
  }

  setRecommendationStatus(id: number, status: "approved" | "dismissed"): void {
    this.raw.prepare("UPDATE recommendations SET status = ? WHERE id = ?").run(status, id);
  }

  overview(): Overview {
    const count = (sql: string): number => (this.raw.prepare(sql).get() as unknown as CountRow).count;
    return {
      totals: {
        openJobs: count("SELECT COUNT(*) AS count FROM jobs WHERE status != 'delivered'"),
        unassigned: count("SELECT COUNT(*) AS count FROM jobs WHERE status = 'unassigned'"),
        inTransit: count("SELECT COUNT(*) AS count FROM jobs WHERE status = 'in_transit'"),
        exceptions: count("SELECT COUNT(*) AS count FROM jobs WHERE status = 'exception'"),
        availableDrivers: count("SELECT COUNT(*) AS count FROM drivers WHERE status = 'available'"),
      },
      jobs: this.listJobs(),
      drivers: this.listDrivers(),
      alerts: this.listAlerts(),
      recommendations: this.listRecommendations(),
    };
  }

  private recommendationQuery(where: string) {
    return this.raw.prepare(`
      SELECT recommendations.*, jobs.reference AS job_reference, drivers.name AS driver_name
      FROM recommendations
      JOIN jobs ON jobs.id = recommendations.job_id
      JOIN drivers ON drivers.id = recommendations.driver_id
      ${where}
      ORDER BY recommendations.created_at DESC
    `);
  }
}

function parseRecommendation(row: unknown): RecommendationRecord {
  const typed = row as Omit<RecommendationRecord, "rationale"> & { rationale: string };
  return { ...typed, rationale: JSON.parse(typed.rationale) as string[] };
}
