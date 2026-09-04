# DispatchOps architecture

```text
React + TypeScript client
        │ HTTP cookie + SSE
        ▼
Express API ── Zod validation ── RBAC policy
        │
        ├── Dispatch agent: observe → rank → propose → await approval
        ├── Event hub: operational changes → authenticated SSE clients
        └── SQLite repository: users, jobs, drivers, alerts, recommendations
```

## Design boundaries

- The browser never receives the session token; it remains in an HTTP-only, same-site cookie.
- Viewers can read. Dispatchers can run analysis, approve proposals, edit jobs and resolve alerts.
- The agent is deterministic and explainable. It cannot assign a driver until a dispatcher approves a current proposal.
- SQLite keeps local setup friction low. The repository layer is the seam for replacing it with PostgreSQL; that adapter is not implemented and is not claimed.
- SSE invalidates the dashboard after mutations. It is not a message broker and does not guarantee replay.

## Agent decision policy

The planner filters out unavailable or full drivers, enforces specialist skills, then prefers the job's region and the lower load ratio. It records plain-language reasons. The temporary 45-minute ETA is explicitly marked as an uncalibrated placeholder in code; real routing data must replace it before operational use.

## Production gaps

This is a portfolio system, not production dispatch software. Production would still need PostgreSQL, durable event delivery, maps/routing integration, audit logs, SSO, secrets management, observability, migrations, backups, accessibility testing and deployment-specific calibration.
