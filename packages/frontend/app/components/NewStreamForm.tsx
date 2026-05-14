"use client";

/**
 * app/components/NewStreamForm.tsx
 *
 * Form to create a new token stream by invoking the Soroban contract.
 * Validates input, calls createStream(), and shows transaction feedback.
 */

import { useState } from "react";
import { Send, Info } from "lucide-react";
import { createStream } from "@/lib/contract";

interface NewStreamFormProps {
  senderPublicKey: string;
  onSuccess?: (streamId: bigint) => void;
}

interface FormState {
  recipientAddress: string;
  tokenAddress: string;
  totalAmountXLM: string;   // user enters XLM, we convert to stroops
  durationDays: string;
  durationHours: string;
  durationMinutes: string;
}

const INITIAL_STATE: FormState = {
  recipientAddress: "",
  tokenAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN3", // XLM native asset contract (Testnet)
  totalAmountXLM: "",
  durationDays: "0",
  durationHours: "1",
  durationMinutes: "0",
};

// ── Helpers ───────────────────────────────────────────────

function xlmToStroops(xlm: string): bigint {
  const num = parseFloat(xlm);
  if (isNaN(num) || num <= 0) throw new Error("Invalid amount");
  return BigInt(Math.round(num * 10_000_000));
}

function parseDurationSeconds(
  days: string,
  hours: string,
  minutes: string
): bigint {
  const d = parseInt(days, 10) || 0;
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  const total = d * 86400 + h * 3600 + m * 60;
  if (total <= 0) throw new Error("Duration must be greater than 0");
  return BigInt(total);
}

function computeRatePerSec(
  totalAmountXLM: string,
  days: string,
  hours: string,
  minutes: string
): string {
  try {
    const stroops = xlmToStroops(totalAmountXLM);
    const duration = parseDurationSeconds(days, hours, minutes);
    if (duration === 0n) return "—";
    const rate = stroops / duration;
    const rateXLM = Number(rate) / 10_000_000;
    return `${rateXLM.toFixed(7)} XLM/sec`;
  } catch {
    return "—";
  }
}

// ── Component ─────────────────────────────────────────────

export function NewStreamForm({ senderPublicKey, onSuccess }: NewStreamFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ratePreview = computeRatePerSec(
    form.totalAmountXLM,
    form.durationDays,
    form.durationHours,
    form.durationMinutes
  );

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setError(null);
      setSuccess(null);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      // Validate
      if (!form.recipientAddress.startsWith("G") || form.recipientAddress.length !== 56) {
        throw new Error("Invalid recipient address — must be a valid G... Stellar public key.");
      }
      if (!form.tokenAddress) {
        throw new Error("Token contract address is required.");
      }

      const totalAmount = xlmToStroops(form.totalAmountXLM);
      const duration = parseDurationSeconds(
        form.durationDays,
        form.durationHours,
        form.durationMinutes
      );

      // Check divisibility (contract requires no fractional stroops per second)
      if (totalAmount % duration !== 0n) {
        throw new Error(
          `Amount (${totalAmount} stroops) is not evenly divisible by duration (${duration}s). ` +
          `Adjust amount to be a multiple of ${duration}.`
        );
      }

      const streamId = await createStream({
        senderPublicKey,
        recipientAddress: form.recipientAddress,
        tokenAddress: form.tokenAddress,
        totalAmount,
        durationSeconds: duration,
      });

      setSuccess(`Stream #${streamId} created successfully! 🎉`);
      setForm(INITIAL_STATE);
      onSuccess?.(streamId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #1447ff, #00e5ff)" }}
        >
          <Send className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">Start a New Stream</h2>
          <p className="text-xs text-slate-500">
            Lock tokens and stream them linearly to a recipient
          </p>
        </div>
      </div>

      <form id="new-stream-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Recipient */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Recipient Address
          </label>
          <input
            id="stream-recipient"
            type="text"
            className="input-field"
            placeholder="GXXXXXXX...  (Stellar public key)"
            value={form.recipientAddress}
            onChange={handleChange("recipientAddress")}
            required
            maxLength={56}
          />
        </div>

        {/* Token */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Token Contract Address
          </label>
          <input
            id="stream-token"
            type="text"
            className="input-field font-mono text-xs"
            placeholder="CXXXXXXX...  (Soroban token contract)"
            value={form.tokenAddress}
            onChange={handleChange("tokenAddress")}
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Total Amount (XLM)
          </label>
          <div className="relative">
            <input
              id="stream-amount"
              type="number"
              className="input-field pr-16"
              placeholder="e.g. 1000"
              min="0.0000001"
              step="0.0000001"
              value={form.totalAmountXLM}
              onChange={handleChange("totalAmountXLM")}
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
              XLM
            </span>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Stream Duration
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { key: "durationDays", label: "Days", id: "stream-duration-days" },
                { key: "durationHours", label: "Hours", id: "stream-duration-hours" },
                { key: "durationMinutes", label: "Minutes", id: "stream-duration-minutes" },
              ] as const
            ).map(({ key, label, id }) => (
              <div key={key}>
                <label className="block text-xs text-slate-600 mb-1">{label}</label>
                <input
                  id={id}
                  type="number"
                  className="input-field text-center"
                  min="0"
                  value={form[key]}
                  onChange={handleChange(key)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Rate Preview */}
        <div
          className="flex items-start gap-2.5 rounded-xl p-4"
          style={{
            background: "rgba(20,71,255,0.08)",
            border: "1px solid rgba(20,71,255,0.2)",
          }}
        >
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#00e5ff" }} />
          <div className="text-xs text-slate-400 space-y-1">
            <p>
              Streaming rate:{" "}
              <span className="font-mono font-semibold" style={{ color: "#00e5ff" }}>
                {ratePreview}
              </span>
            </p>
            <p className="text-slate-600">
              Tokens are streamed linearly:{" "}
              <span className="font-mono">rate = total_amount ÷ duration</span>
            </p>
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="rounded-xl px-4 py-3 text-xs font-semibold"
            style={{
              background: "rgba(16,212,142,0.1)",
              border: "1px solid rgba(16,212,142,0.2)",
              color: "#10d48e",
            }}
          >
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          id="create-stream-submit"
          type="submit"
          className="btn-primary w-full py-4 text-sm"
          disabled={isSubmitting}
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? "Creating Stream..." : "Create Stream"}
        </button>
      </form>
    </div>
  );
}
