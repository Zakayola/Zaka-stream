"use client";

/**
 * app/components/StreamCard.tsx
 *
 * Displays a single stream with:
 * - Live balance counter
 * - Status badge
 * - Sender/recipient addresses
 * - Withdraw and Cancel action buttons
 */

import { useState } from "react";
import { Zap, X, ArrowDownCircle, Clock } from "lucide-react";
import { LiveBalance } from "./LiveBalance";
import { withdrawFromStream, cancelStream } from "@/lib/contract";

// ── Types ─────────────────────────────────────────────────

interface StreamCardProps {
  id: string;
  sender: string;
  recipient: string;
  totalAmount: string;
  withdrawnAmount: string;
  ratePerSecond: string;
  startTime: number;
  stopTime: number;
  status: "active" | "cancelled" | "completed";
  connectedAddress?: string;
}

// ── Helpers ───────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDuration(start: number, stop: number): string {
  const totalSecs = stop - start;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function mapStatus(
  status: string
): "Active" | "Cancelled" | "Completed" {
  if (status === "active") return "Active";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}

// ── Component ─────────────────────────────────────────────

export function StreamCard({
  id,
  sender,
  recipient,
  totalAmount,
  withdrawnAmount,
  ratePerSecond,
  startTime,
  stopTime,
  status,
  connectedAddress,
}: StreamCardProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const mappedStatus = mapStatus(status);
  const isRecipient = connectedAddress === recipient;
  const isSender = connectedAddress === sender;

  const handleWithdraw = async () => {
    setTxError(null);
    setTxSuccess(null);
    setIsWithdrawing(true);
    try {
      const amount = await withdrawFromStream(
        connectedAddress!,
        BigInt(id)
      );
      setTxSuccess(`Withdrawn ${amount.toLocaleString()} stroops successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxError(msg);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCancel = async () => {
    setTxError(null);
    setTxSuccess(null);
    setIsCancelling(true);
    try {
      const { senderRefund } = await cancelStream(
        connectedAddress!,
        BigInt(id)
      );
      setTxSuccess(`Stream cancelled. Refunded ${senderRefund.toLocaleString()} stroops.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-5 animate-slide-up hover:border-brand-500/30 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(20, 71, 255, 0.2)" }}
          >
            <Zap className="h-4 w-4" style={{ color: "#00e5ff" }} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-mono">Stream #{id}</p>
            <p className="text-sm font-semibold text-slate-200">
              <Clock className="inline h-3 w-3 mr-1 text-slate-500" />
              {formatDuration(startTime, stopTime)}
            </p>
          </div>
        </div>
        <span className={`status-badge-${status}`}>
          {status === "active" && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
          )}
          {mappedStatus}
        </span>
      </div>

      {/* Address Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-slate-500 mb-1">From</p>
          <p className="text-xs font-mono text-slate-300 truncate" title={sender}>
            {shortenAddress(sender)}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs text-slate-500 mb-1">To</p>
          <p className="text-xs font-mono text-slate-300 truncate" title={recipient}>
            {shortenAddress(recipient)}
          </p>
        </div>
      </div>

      {/* Live Balance */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "rgba(20, 71, 255, 0.08)",
          border: "1px solid rgba(20, 71, 255, 0.2)",
        }}
      >
        <LiveBalance
          ratePerSecond={BigInt(ratePerSecond)}
          startTime={BigInt(startTime)}
          stopTime={BigInt(stopTime)}
          withdrawnAmount={BigInt(withdrawnAmount)}
          status={mappedStatus}
          tokenSymbol="XLM"
          decimals={7}
        />
      </div>

      {/* Feedback */}
      {txError && (
        <div className="rounded-lg px-4 py-2.5 text-xs text-red-400"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {txError}
        </div>
      )}
      {txSuccess && (
        <div className="rounded-lg px-4 py-2.5 text-xs"
          style={{ background: "rgba(16,212,142,0.1)", border: "1px solid rgba(16,212,142,0.2)", color: "#10d48e" }}>
          {txSuccess}
        </div>
      )}

      {/* Actions */}
      {status === "active" && connectedAddress && (
        <div className="flex gap-3">
          {isRecipient && (
            <button
              id={`withdraw-stream-${id}`}
              className="btn-primary flex-1 text-xs py-2.5"
              onClick={handleWithdraw}
              disabled={isWithdrawing}
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              {isWithdrawing ? "Withdrawing..." : "Withdraw"}
            </button>
          )}
          {isSender && (
            <button
              id={`cancel-stream-${id}`}
              className="btn-secondary flex-1 text-xs py-2.5 text-red-400 hover:text-red-300"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              <X className="h-3.5 w-3.5" />
              {isCancelling ? "Cancelling..." : "Cancel Stream"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
