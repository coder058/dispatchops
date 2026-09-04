# Rebuild DispatchOps step by step

Use this as a reverse-engineering syllabus. Rebuild each stage on a new branch, compare it with the finished implementation, then write down what changed.

## 1. Model the operation

Start with five nouns: user, driver, job, alert and recommendation. Define valid statuses before building UI. Add database constraints so impossible values fail close to the data.

Checkpoint: seed a database and query an ordered dispatch queue.

## 2. Build the API boundary

Create Express endpoints for health, authentication and the overview. Validate every mutation with Zod. Return useful 400/401/403/404/409 errors instead of one generic failure.

Checkpoint: log in with Supertest and read the overview using its cookie jar.

## 3. Add authentication and authorization

Hash passwords, issue a signed HTTP-only cookie and add `requireAuth`. Add `requireRole("dispatcher")` to mutations. Verify that a viewer receives 403.

Checkpoint: run the permission test before opening the frontend.

## 4. Implement the agent as a policy

Keep observation separate from action. Filter drivers by availability, capacity and required skill. Rank exact-region drivers first and lower-load drivers second. Persist explanations. Do not mutate jobs here.

Checkpoint: the same seed always produces the same recommendation and reasons.

## 5. Add human approval

On approval, reload the recommendation, job and driver. Reject stale proposals. Only then assign the job, increment workload and mark the proposal approved.

Checkpoint: a pending proposal leaves its job unassigned; an approved proposal changes it.

## 6. Build the React control tower

Fetch one overview object and render metrics, relative job map, queue, fleet, exceptions and agent desk. Derive every visible count from API data. Avoid invented performance claims.

Checkpoint: dispatcher and viewer see the same data but different controls.

## 7. Make updates live

Open an authenticated EventSource. Publish a small event after each mutation and refresh the overview when it arrives. Add a visible connection state.

Checkpoint: two open browser windows converge after an approval.

## 8. Harden and package

Add Helmet, login rate limiting, payload limits, an OpenAPI file, tests, lint/type checks, a multi-stage Dockerfile and CI.

Checkpoint: `npm run check` passes from a clean install.

## Suggested exercises

1. Replace the ETA placeholder with a routing-provider adapter and mock it in tests.
2. Add an append-only audit log for every dispatcher mutation.
3. Implement a PostgreSQL repository without changing route handlers.
4. Add a background worker and durable event broker.
5. Add an optional LLM summarizer that can explain alerts but cannot call mutation tools.

The final honest risk: the current planner is a transparent demo heuristic. It has not been calibrated against real delivery outcomes and could make poor operational suggestions.
