"use client";

/**
 * app/components/LiveBalance.tsx
 *
 * Real-time streaming balance counter.
 *
 * Uses setInterval every 250ms to re-compute the local balance
 * using the same linear formula as the Soroban contract:
 *
 *   withdrawable = ratePerSecond × (now − startTime) − withdrawnAmount
 *
 * No RPC calls are needed for display — math is done client-side.
 * This gives a perfectly smooth "ticker" effect.
 */

import { useState, useEffect, useRef } from "react";
import { computeLocalWithdrawable } from "@/lib/contract";

// ── Types ─────────────────────────────────────────────────

interface LiveBalanceProps {
  ratePerSecond: bigint;
  startTime: bigint;
  stopTime: bigint;
  withdrawnAmount: bigint;
  status: "Active" | "Cancelled" | "Completed";
  tokenSymbol?: string;
  /** Number of decimals for the token (7 for XLM stroops) */
  decimals?: number;
}

// ── Formatting Helpers ────────────────────────────────────

function formatBalance(stroops: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = stroops / divisor;
  const frac = stroops % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole.toLocaleString()}.${fracStr}`;
}

// ── Component ─────────────────────────────────────────────

export function LiveBalance({
  ratePerSecond,
  startTime,
  stopTime,
  withdrawnAmount,
  status,
  tokenSymbol = "XLM",
  decimals = 7,
}: LiveBalanceProps) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevBalance = useRef<bigint>(0n);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const compute = () => {
      const current = computeLocalWithdrawable({
        ratePerSecond,
        startTime,
        stopTime,
        withdrawnAmount,
        status,
      });

      if (current !== prevBalance.current) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 120);
        prevBalance.current = current;
      }

      setBalance(current);
    };

    compute(); // immediate
    intervalRef.current = setInterval(compute, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ratePerSecond, startTime, stopTime, withdrawnAmount, status]);

  const isActive = status === "Active";
  const totalStream = ratePerSecond * (stopTime - startTime);
  const percentComplete =
    totalStream > 0n
      ? Number((balance * 100n) / totalStream)
      : 0;

  return (
    <div className="space-y-4">
      {/* Balance Display */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
          Live Withdrawable Balance
        </p>
        <div
          className={`font-mono font-bold transition-all duration-100 ${
            isAnimating ? "scale-[1.02]" : "scale-100"
          }`}
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            background: isActive
              ? "linear-gradient(135deg, #1447ff, #00e5ff)"
              : "linear-gradient(135deg, #475569, #64748b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.03em",
          }}
        >
          {formatBalance(balance, decimals)}
        </div>
        <p className="text-slate-400 text-sm mt-1 font-semibold">{tokenSymbol}</p>
      </div>

      {/* Stream Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Streamed</span>
          <span
            className={isActive ? "text-accent-cyan" : "text-slate-400"}
            style={{ color: isActive ? "#00e5ff" : undefined }}
          >
            {Math.min(percentComplete, 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={isActive ? "stream-progress-bar h-full rounded-full transition-all duration-300" : "h-full rounded-full bg-slate-600 transition-all duration-300"}
            style={{ width: `${Math.min(percentComplete, 100)}%` }}
          />
        </div>
      </div>

      {/* Rate indicator */}
      {isActive && (
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "#10d48e" }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: "#10d48e" }}
            />
          </span>
          <span className="text-xs text-slate-400">
            Streaming at{" "}
            <span className="font-mono font-semibold" style={{ color: "#10d48e" }}>
              {formatBalance(ratePerSecond, decimals)}
            </span>{" "}
            {tokenSymbol}/sec
          </span>
        </div>
      )}
    </div>
  );
}
