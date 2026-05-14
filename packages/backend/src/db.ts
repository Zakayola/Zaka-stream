/**
 * db.ts — Local JSON persistence layer for stream records.
 *
 * In production this would be replaced by a proper database (PostgreSQL, etc.).
 * For Drips Wave demo purposes, we persist to a local .json file.
 */

import fs from "node:fs";
import path from "node:path";

// ── Types ─────────────────────────────────────────────────

export type StreamStatus = "active" | "cancelled" | "completed";

export interface StreamRecord {
  id: string;           // uint64 stream ID as string
  sender: string;       // G... stellar address
  recipient: string;    // G... stellar address
  token: string;        // contract address of the token
  totalAmount: string;  // i128 stored as string to avoid JS number precision loss
  withdrawnAmount: string;
  startTime: number;    // Unix timestamp (seconds)
  stopTime: number;     // Unix timestamp (seconds)
  ratePerSecond: string;
  status: StreamStatus;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

export interface StreamsDB {
  streams: Record<string, StreamRecord>;
  lastIndexedLedger: number;
}

// ── DB File Resolution ────────────────────────────────────

const dbPath = path.resolve(
  process.env.STREAMS_DB_PATH ?? "data/streams.json"
);

// ── Helpers ───────────────────────────────────────────────

function ensureDbDir(): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function emptyDb(): StreamsDB {
  return { streams: {}, lastIndexedLedger: 0 };
}

// ── Read / Write ──────────────────────────────────────────

export function readDb(): StreamsDB {
  ensureDbDir();
  if (!fs.existsSync(dbPath)) {
    return emptyDb();
  }
  try {
    const raw = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(raw) as StreamsDB;
  } catch {
    return emptyDb();
  }
}

export function writeDb(data: StreamsDB): void {
  ensureDbDir();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Domain Methods ────────────────────────────────────────

export function upsertStream(stream: StreamRecord): void {
  const db = readDb();
  db.streams[stream.id] = stream;
  writeDb(db);
}

export function getStreamById(id: string): StreamRecord | undefined {
  return readDb().streams[id];
}

export function getStreamsBySender(sender: string): StreamRecord[] {
  const db = readDb();
  return Object.values(db.streams).filter((s) => s.sender === sender);
}

export function getStreamsByRecipient(recipient: string): StreamRecord[] {
  const db = readDb();
  return Object.values(db.streams).filter((s) => s.recipient === recipient);
}

export function getAllStreams(): StreamRecord[] {
  return Object.values(readDb().streams);
}

export function setLastIndexedLedger(ledger: number): void {
  const db = readDb();
  db.lastIndexedLedger = ledger;
  writeDb(db);
}

export function getLastIndexedLedger(): number {
  return readDb().lastIndexedLedger;
}
