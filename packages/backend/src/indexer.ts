/**
 * indexer.ts — Polls Soroban contract events and indexes stream state.
 *
 * Uses @stellar/stellar-sdk's SorobanRpc.Server to fetch contract events
 * from the Stellar Testnet, then persists them to the local JSON store.
 *
 * Events indexed:
 *   - (create, stream)   → creates a StreamRecord
 *   - (withdraw, stream) → updates withdrawnAmount
 *   - (cancel, stream)   → marks stream as cancelled
 */

import { SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import pino from "pino";
import {
  upsertStream,
  getStreamById,
  setLastIndexedLedger,
  getLastIndexedLedger,
  type StreamRecord,
} from "./db.js";

const logger = pino({
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
}).child({ module: "indexer" });

// ── Config ────────────────────────────────────────────────

const RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID ?? "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);

// ── RPC Client ────────────────────────────────────────────

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ── Event Parsing Helpers ─────────────────────────────────

function scToString(val: xdr.ScVal): string {
  try {
    const native = scValToNative(val);
    return String(native);
  } catch {
    return "";
  }
}

function scToNumber(val: xdr.ScVal): number {
  return Number(scToString(val));
}

// ── Core Indexer Logic ────────────────────────────────────

async function fetchAndIndexEvents(fromLedger: number): Promise<number> {
  if (!CONTRACT_ID) {
    logger.warn("CONTRACT_ID not set — skipping event fetch");
    return fromLedger;
  }

  let latestLedger = fromLedger;

  try {
    const response = await server.getEvents({
      startLedger: fromLedger,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_ID],
        },
      ],
      limit: 100,
    });

    for (const event of response.events) {
      latestLedger = Math.max(latestLedger, event.ledger);

      const topics = event.topic;
      if (topics.length < 2) continue;

      const action = scToString(topics[0]);  // "create" | "withdraw" | "cancel"
      const subject = scToString(topics[1]); // "stream"

      if (subject !== "stream") continue;

      const values = event.value;
      if (!values) continue;

      const native = scValToNative(values);

      logger.info({ action, event: native }, `Received '${action}' event`);

      try {
        if (action === "create") {
          // Tuple: (stream_id, sender, recipient, total_amount, duration_seconds)
          const [streamId, sender, recipient, totalAmount, durationSeconds] =
            native as [bigint, string, string, bigint, bigint];

          const startTime = Math.floor(Date.now() / 1000); // approximate; real: ledger timestamp
          const stopTime = startTime + Number(durationSeconds);
          const ratePerSecond =
            Number(durationSeconds) > 0
              ? (BigInt(totalAmount) / BigInt(durationSeconds)).toString()
              : "0";

          const record: StreamRecord = {
            id: streamId.toString(),
            sender,
            recipient,
            token: "", // token address not in event; could query contract state
            totalAmount: totalAmount.toString(),
            withdrawnAmount: "0",
            startTime,
            stopTime,
            ratePerSecond,
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          upsertStream(record);
          logger.info({ streamId: record.id }, "Indexed new stream");
        } else if (action === "withdraw") {
          // Tuple: (stream_id, recipient, amount)
          const [streamId, _recipient, amount] = native as [
            bigint,
            string,
            bigint
          ];
          const existing = getStreamById(streamId.toString());
          if (existing) {
            existing.withdrawnAmount = (
              BigInt(existing.withdrawnAmount) + BigInt(amount)
            ).toString();
            existing.updatedAt = new Date().toISOString();
            if (existing.withdrawnAmount === existing.totalAmount) {
              existing.status = "completed";
            }
            upsertStream(existing);
            logger.info({ streamId: existing.id }, "Indexed withdrawal");
          }
        } else if (action === "cancel") {
          // Tuple: (stream_id, sender, recipient_portion, sender_refund)
          const [streamId] = native as [bigint, string, bigint, bigint];
          const existing = getStreamById(streamId.toString());
          if (existing) {
            existing.status = "cancelled";
            existing.updatedAt = new Date().toISOString();
            upsertStream(existing);
            logger.info({ streamId: existing.id }, "Indexed cancellation");
          }
        }
      } catch (parseErr) {
        logger.error({ err: parseErr, action }, "Failed to parse event data");
      }
    }
  } catch (err) {
    logger.error({ err }, "Error fetching events from Soroban RPC");
  }

  return latestLedger;
}

// ── Start Indexer Loop ────────────────────────────────────

export async function startIndexer(): Promise<void> {
  logger.info(
    { rpc: RPC_URL, contract: CONTRACT_ID, interval: POLL_INTERVAL_MS },
    "Starting Zaka-Stream indexer"
  );

  let fromLedger = getLastIndexedLedger();

  // If never indexed, start from the current ledger
  if (fromLedger === 0) {
    try {
      const info = await server.getLatestLedger();
      fromLedger = Math.max(0, info.sequence - 1);
      logger.info({ fromLedger }, "Starting indexer from current ledger");
    } catch {
      fromLedger = 1;
    }
  }

  const tick = async () => {
    const newLedger = await fetchAndIndexEvents(fromLedger);
    if (newLedger > fromLedger) {
      fromLedger = newLedger + 1;
      setLastIndexedLedger(fromLedger);
    }
  };

  // Immediate first run, then poll
  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
