# DispatchOps

What happens to a delivery plan when an urgent request arrives, a vehicle drops out and the dispatcher still has to explain every choice?

DispatchOps is an interactive, fictional shift built from the kind of queue, capacity and exception decisions I encountered in logistics work. You assign deliveries, respond to incidents and decide whether to accept a recommendation or choose an operator yourself. The final screen walks back through the decisions you made.

The recommendation engine is a small, inspectable ruleset—not an LLM and not a route optimiser. It checks required skills, capacity, region and current load, then waits for human approval before changing the shift.

## What I practised

- React and TypeScript state across a timed, replayable interface
- An Express API with SQLite, Zod validation and role-based access
- Authenticated server-sent events for live updates
- HTTP-only sessions, Helmet, login rate limiting and permission tests
- An OpenAPI contract, integration tests and a Docker build

## The data boundary

Every driver, delivery and incident is synthetic. Travel times, handling time and score weights are gameplay guesses marked in the source; they are not Amsterdam routing data or operating benchmarks.

## Run locally

Requires Node.js 24 because the local repository uses Node's built-in SQLite module.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The game itself requires no account.

Optional API scenario accounts:

| Role | Email | Password |
|---|---|---|
| Dispatcher | `dispatcher@dispatchops.local` | `dispatch123` |
| Viewer | `viewer@dispatchops.local` | `viewer123` |

These are fictional local credentials. Never reuse them in a deployed environment.

## Verify

```bash
npm run check
```

This runs lint, TypeScript checks, tests and the production build.

## Project notes

- [Step-by-step rebuild guide](docs/BUILD_GUIDE.md)
- [Architecture and honest production gaps](docs/ARCHITECTURE.md)
- [OpenAPI contract](docs/api.openapi.yml)

## Security and deployment

Copy `.env.example` and set a strong `JWT_SECRET` before a production-mode start. The app refuses to use its local fallback secret in production. The Docker image exposes port 4100 and expects a writable `/app/data` directory.

This is a portfolio simulator, not production dispatch software. Real use would still need routing data, durable event delivery, PostgreSQL, audit logs, SSO, observability, backups and deployment-specific calibration.
