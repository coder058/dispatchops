# DispatchOps

What happens to a delivery plan when an urgent request arrives, a vehicle drops out and the dispatcher still has to explain every choice?

DispatchOps is a turn-based dispatch game built from the queue, capacity and exception decisions I encountered in logistics work. A schematic Amsterdam map shows delivery destinations, assigned routes and driver progress. You assign deliveries, respond to incidents and compare suggested matches with your own choices. The final screen walks back through the decisions you made.

[Play the shift](https://dispatchops-xi.vercel.app/)

## How to play

1. Start the guided shift. The clock stays at 09:00 until you advance it.
2. Select a delivery on the map or in the manifest. Compare its required skill, target time and each driver's predicted arrival.
3. Assign a suggested or manually chosen driver. Drivers complete queued jobs in order; their next route starts where the previous delivery ends.
4. Advance 15 minutes when you are ready. Watch deliveries finish, respond to the urgent request, reassign work after the vehicle failure and account for the West restriction.
5. Finish the scenario and review the delivery results and decision log. Replay uses the same fictional starting data.

The recommendation engine is an inspectable ruleset. It checks skills and capacity, then compares predicted completion times including queued work. It does not use an LLM or real routing data.

## What I practised

- React and TypeScript state across an interactive map and replayable game
- A separate Express API with SQLite, Zod validation and role-based access
- Authenticated server-sent events for live updates
- HTTP-only sessions, Helmet, login rate limiting and permission tests
- An OpenAPI contract, integration tests and a Docker build

## The data boundary

Every driver, delivery and incident is synthetic. Travel times, handling time and score weights are gameplay guesses marked in the source; they are not Amsterdam routing data or operating benchmarks.

The public game runs entirely in browser memory. The Express/SQLite service is a separate local API demonstration; the hosted game does not claim server persistence, authentication or live updates from that API.

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
