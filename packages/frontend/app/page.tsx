"use client";

/**
 * app/page.tsx — Zaka-Stream Dashboard
 *
 * Main page with:
 * - Hero header with Freighter wallet connect/disconnect
 * - Active streams grid with live balance counters
 * - "Start a New Stream" form
 * - Streams are fetched from the backend REST API
 */

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Wallet, LogOut, RefreshCw,
  LayoutGrid, PlusCircle, Github, ExternalLink
} from "lucide-react";
import { StreamCard } from "./components/StreamCard";
import { NewStreamForm } from "./components/NewStreamForm";
import {
  connectFreighter,
  checkFreighterInstalled,
  type FreighterError,
} from "@/lib/freighter";

// ── Types ─────────────────────────────────────────────────

interface StreamRecord {
  id: string;
  sender: string;
  recipient: string;
  totalAmount: string;
  withdrawnAmount: string;
  ratePerSecond: string;
  startTime: number;
  stopTime: number;
  status: "active" | "cancelled" | "completed";
}

// ── Config ────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

// ── Component ─────────────────────────────────────────────

export default function DashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [freighterInstalled, setFreighterInstalled] = useState<boolean | null>(null);

  const [streams, setStreams] = useState<StreamRecord[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [streamsError, setStreamsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"streams" | "create">("streams");
  const [streamFilter, setStreamFilter] = useState<"all" | "active" | "mine">("active");

  // ── Freighter check ────────────────────────────────────

  useEffect(() => {
    checkFreighterInstalled().then(setFreighterInstalled);
  }, []);

  // ── Wallet connect ─────────────────────────────────────

  const handleConnect = async () => {
    setWalletError(null);
    setIsConnecting(true);
    try {
      const address = await connectFreighter();
      setWalletAddress(address);
    } catch (err) {
      const fe = err as FreighterError;
      setWalletError(fe.message ?? "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setStreams([]);
  };

  // ── Fetch streams ──────────────────────────────────────

  const fetchStreams = useCallback(async () => {
    setIsLoadingStreams(true);
    setStreamsError(null);
    try {
      let url = `${BACKEND_URL}/streams`;
      if (streamFilter === "mine" && walletAddress) {
        url = `${BACKEND_URL}/streams?sender=${walletAddress}`;
      } else if (streamFilter === "active") {
        url = `${BACKEND_URL}/streams?status=active`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setStreams(json.data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamsError(msg);
      // Use demo data when backend is unreachable
      setStreams(DEMO_STREAMS);
    } finally {
      setIsLoadingStreams(false);
    }
  }, [streamFilter, walletAddress]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/8"
        style={{ background: "rgba(5,8,16,0.85)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1447ff, #00e5ff)" }}>
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-100 tracking-tight">
              Zaka<span style={{ color: "#00e5ff" }}>-Stream</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(20,71,255,0.2)", color: "#7c9dff", border: "1px solid rgba(20,71,255,0.3)" }}>
              Testnet
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/zakayola/Zaka-Stream"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>

            {walletAddress ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono"
                  style={{ background: "rgba(16,212,142,0.1)", border: "1px solid rgba(16,212,142,0.2)", color: "#10d48e" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
                <button
                  id="disconnect-wallet"
                  className="btn-secondary text-xs px-3 py-1.5 text-red-400 hover:text-red-300"
                  onClick={handleDisconnect}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                id="connect-wallet"
                className="btn-primary text-xs px-4 py-2"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                <Wallet className="h-3.5 w-3.5" />
                {isConnecting
                  ? "Connecting..."
                  : freighterInstalled === false
                  ? "Install Freighter"
                  : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────── */}
      <header className="py-16 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-2"
            style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            Drips Wave Program
            <ExternalLink className="h-3 w-3" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-100 tracking-tight leading-tight">
            Token streaming,{" "}
            <span style={{
              background: "linear-gradient(135deg, #1447ff, #00e5ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              second by second
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Decentralized payroll and grant distribution on Stellar.
            Stream any asset continuously to recipients — no intermediaries, no trust required.
          </p>

          {walletError && (
            <div className="inline-block mt-2 rounded-xl px-4 py-2 text-sm text-red-400"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {walletError}
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 pb-20">
        {/* Tab Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-1 p-1 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              id="tab-streams"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "streams"
                  ? "text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              style={activeTab === "streams" ? {
                background: "rgba(20,71,255,0.25)",
                border: "1px solid rgba(20,71,255,0.35)",
              } : {}}
              onClick={() => setActiveTab("streams")}
            >
              <LayoutGrid className="h-4 w-4" />
              Dashboard
            </button>
            <button
              id="tab-create"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "create"
                  ? "text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
              style={activeTab === "create" ? {
                background: "rgba(20,71,255,0.25)",
                border: "1px solid rgba(20,71,255,0.35)",
              } : {}}
              onClick={() => setActiveTab("create")}
              disabled={!walletAddress}
              title={!walletAddress ? "Connect wallet to create a stream" : undefined}
            >
              <PlusCircle className="h-4 w-4" />
              New Stream
            </button>
          </div>

          {activeTab === "streams" && (
            <div className="flex items-center gap-2">
              {/* Filter */}
              <div className="flex gap-1 p-1 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {(["all", "active", "mine"] as const).map((f) => (
                  <button
                    key={f}
                    id={`filter-${f}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 capitalize ${
                      streamFilter === f ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
                    }`}
                    style={streamFilter === f ? { background: "rgba(255,255,255,0.08)" } : {}}
                    onClick={() => setStreamFilter(f)}
                  >
                    {f === "mine" ? "My Streams" : f}
                  </button>
                ))}
              </div>

              <button
                id="refresh-streams"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={fetchStreams}
                disabled={isLoadingStreams}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingStreams ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>

        {/* Streams Grid */}
        {activeTab === "streams" && (
          <>
            {streamsError && (
              <div className="rounded-xl px-4 py-3 text-sm text-amber-400 mb-6"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                ⚠️ Could not reach backend — showing demo data. Start the backend with{" "}
                <code className="font-mono text-xs">npm run dev</code> in{" "}
                <code className="font-mono text-xs">packages/backend</code>.
              </div>
            )}

            {isLoadingStreams ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card p-6 animate-pulse h-64"
                    style={{ background: "rgba(255,255,255,0.03)" }} />
                ))}
              </div>
            ) : streams.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="text-6xl">⚡</div>
                <p className="text-slate-400 font-semibold">No streams found</p>
                <p className="text-slate-600 text-sm">
                  {walletAddress
                    ? "Create your first stream above."
                    : "Connect your Freighter wallet to get started."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {streams.map((stream) => (
                  <StreamCard
                    key={stream.id}
                    {...stream}
                    connectedAddress={walletAddress ?? undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Form */}
        {activeTab === "create" && walletAddress && (
          <div className="max-w-lg mx-auto">
            <NewStreamForm
              senderPublicKey={walletAddress}
              onSuccess={(id) => {
                setActiveTab("streams");
                fetchStreams();
              }}
            />
          </div>
        )}

        {activeTab === "create" && !walletAddress && (
          <div className="text-center py-20 space-y-4">
            <Wallet className="h-12 w-12 mx-auto text-slate-600" />
            <p className="text-slate-400 font-semibold">Connect your wallet to create a stream</p>
            <button id="connect-wallet-cta" className="btn-primary" onClick={handleConnect}>
              <Wallet className="h-4 w-4" />
              Connect Freighter
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-6 px-6"
        style={{ background: "rgba(5,8,16,0.6)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" style={{ color: "#1447ff" }} />
            <span>Zaka-Stream by{" "}
              <a href="https://github.com/AlAfiz" className="text-slate-500 hover:text-slate-300 transition-colors">
                AlAfiz
              </a>{" "}
              / {" "}
              <a href="https://github.com/zakayola" className="text-slate-500 hover:text-slate-300 transition-colors">
                zakayola
              </a>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/zakayola/Zaka-Stream" className="hover:text-slate-400 transition-colors">
              GitHub
            </a>
            <a href="https://github.com/zakayola/Zaka-Stream/blob/main/CONTRIBUTING.md" className="hover:text-slate-400 transition-colors">
              Contribute
            </a>
            <a href="https://www.drips.network" className="hover:text-slate-400 transition-colors">
              Drips Wave
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Demo Data (when backend is offline) ───────────────────

const NOW = Math.floor(Date.now() / 1000);
const DEMO_STREAMS: StreamRecord[] = [
  {
    id: "1",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    recipient: "GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP",
    totalAmount: "10000000000",
    withdrawnAmount: "1000000000",
    ratePerSecond: "1000000",
    startTime: NOW - 1000,
    stopTime: NOW + 9000,
    status: "active",
  },
  {
    id: "2",
    sender: "GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP",
    recipient: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    totalAmount: "5000000000",
    withdrawnAmount: "2500000000",
    ratePerSecond: "500000",
    startTime: NOW - 5000,
    stopTime: NOW + 5000,
    status: "active",
  },
  {
    id: "3",
    sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    recipient: "GD6TQJNPZ7KZQG5LQVFXKDXLZL3CRTQMEKXHZH2HKBQJF2MXBSQYB6",
    totalAmount: "3000000000",
    withdrawnAmount: "3000000000",
    ratePerSecond: "300000",
    startTime: NOW - 10000,
    stopTime: NOW - 1,
    status: "completed",
  },
];
