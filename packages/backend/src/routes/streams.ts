/**
 * routes/streams.ts — REST endpoints for querying indexed stream data.
 *
 * Endpoints:
 *   GET /streams?sender=G...            — all streams by sender address
 *   GET /streams?receiver=G...          — all streams by recipient address
 *   GET /streams/:id                    — single stream by ID
 *   GET /streams                        — all streams (paginated, limit/offset)
 *   GET /health                         — health check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  getAllStreams,
  getStreamById,
  getStreamsBySender,
  getStreamsByRecipient,
  type StreamRecord,
} from "../db.js";

// ── Schema Validation ─────────────────────────────────────

const StreamsQuerySchema = z.object({
  sender: z.string().optional(),
  receiver: z.string().optional(),
  status: z.enum(["active", "cancelled", "completed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Live Balance Calculation ──────────────────────────────

/**
 * Computes the real-time withdrawable balance for a stream.
 * Mirrors the Soroban contract math in TypeScript for UI display.
 *
 *   ratePerSecond = totalAmount / durationSeconds
 *   streamed      = ratePerSecond × elapsed
 *   withdrawable  = streamed − withdrawnAmount
 */
function computeLiveBalance(stream: StreamRecord): {
  streamed: string;
  withdrawable: string;
  percentComplete: number;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const effectiveNow = Math.min(nowSec, stream.stopTime);

  if (effectiveNow <= stream.startTime || stream.status !== "active") {
    return {
      streamed: stream.withdrawnAmount,
      withdrawable: "0",
      percentComplete:
        stream.status === "completed"
          ? 100
          : ((nowSec - stream.startTime) /
              (stream.stopTime - stream.startTime)) *
            100,
    };
  }

  const elapsed = BigInt(effectiveNow - stream.startTime);
  const rate = BigInt(stream.ratePerSecond);
  const streamed = rate * elapsed;
  const withdrawn = BigInt(stream.withdrawnAmount);
  const withdrawable = streamed > withdrawn ? streamed - withdrawn : 0n;

  const total = BigInt(stream.totalAmount);
  const percentComplete =
    total > 0n ? Number((streamed * 100n) / total) : 0;

  return {
    streamed: streamed.toString(),
    withdrawable: withdrawable.toString(),
    percentComplete: Math.min(percentComplete, 100),
  };
}

function enrichStream(stream: StreamRecord) {
  return {
    ...stream,
    liveBalance: computeLiveBalance(stream),
  };
}

// ── Route Registration ────────────────────────────────────

export async function streamRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   */
  fastify.get("/health", async (_req: FastifyRequest, reply: FastifyReply) => {
    reply.send({
      status: "ok",
      service: "zaka-stream-backend",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /streams
   * Query params: sender, receiver, status, limit, offset
   */
  fastify.get("/streams", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = StreamsQuerySchema.safeParse(req.query);
    if (!query.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: query.error.flatten(),
      });
    }

    const { sender, receiver, status, limit, offset } = query.data;

    let results: StreamRecord[];

    if (sender) {
      results = getStreamsBySender(sender);
    } else if (receiver) {
      results = getStreamsByRecipient(receiver);
    } else {
      results = getAllStreams();
    }

    // Filter by status
    if (status) {
      results = results.filter((s) => s.status === status);
    }

    // Sort by startTime descending (newest first)
    results.sort((a, b) => b.startTime - a.startTime);

    // Paginate
    const total = results.length;
    const page = results.slice(offset, offset + limit).map(enrichStream);

    reply.send({
      data: page,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  });

  /**
   * GET /streams/:id
   */
  fastify.get(
    "/streams/:id",
    async (
      req: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = req.params;
      const stream = getStreamById(id);
      if (!stream) {
        return reply.status(404).send({ error: `Stream '${id}' not found` });
      }
      reply.send({ data: enrichStream(stream) });
    }
  );
}
