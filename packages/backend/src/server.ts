/**
 * server.ts — Zaka-Stream Fastify API Server
 *
 * Starts the REST API and the Soroban event indexer.
 * The indexer runs in the background, polling for contract events.
 */

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import pino from "pino";
import { streamRoutes } from "./routes/streams.js";
import { startIndexer } from "./indexer.js";

const logger = pino({
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// ── Build App ─────────────────────────────────────────────

const app = Fastify({
  loggerInstance: logger,
  disableRequestLogging: false,
});

// CORS — allow frontend dev server
await app.register(cors, {
  origin: [
    "http://localhost:3000",
    "https://zaka-stream.vercel.app",
  ],
  methods: ["GET", "POST", "OPTIONS"],
});

// Register route plugins
await app.register(streamRoutes);

// ── Start Server ──────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

try {
  // Start HTTP server
  await app.listen({ port: PORT, host: HOST });
  logger.info(`⚡ Zaka-Stream API listening on http://${HOST}:${PORT}`);

  // Start the background event indexer
  await startIndexer();
} catch (err) {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
}
