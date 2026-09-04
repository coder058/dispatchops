import type { Response } from "express";

export interface DispatchEvent {
  type: "connected" | "job.updated" | "alert.resolved" | "agent.completed" | "recommendation.updated";
  payload: unknown;
  at: string;
}

export class EventHub {
  private readonly clients = new Set<Response>();

  add(res: Response): () => void {
    this.clients.add(res);
    this.sendTo(res, { type: "connected", payload: { message: "Live operations stream connected" }, at: new Date().toISOString() });
    const heartbeatMs = 25_000; // GUESS: keeps common reverse proxies from closing an idle SSE stream; calibrate against deployed infrastructure.
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), heartbeatMs);
    return () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
    };
  }

  publish(type: DispatchEvent["type"], payload: unknown): void {
    const event: DispatchEvent = { type, payload, at: new Date().toISOString() };
    for (const client of this.clients) this.sendTo(client, event);
  }

  private sendTo(res: Response, event: DispatchEvent): void {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
