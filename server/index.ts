import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";

const defaultPort = 4100; // SOURCE: DispatchOps local port documented in README and Vite proxy.
const port = Number(process.env.PORT ?? defaultPort);
const { app } = createApp();
const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, "../../client");

if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve(clientDir, "index.html")));
}

app.listen(port, "127.0.0.1", () => {
  console.log(`DispatchOps API listening on http://127.0.0.1:${port}`);
});
