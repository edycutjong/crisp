"use client";

import { useState } from "react";

type Result = {
  valid_proof: boolean;
  tampered_proof: boolean;
  verifier: string;
  explorer: string;
} | null;

export default function VerifyOnchainPanel() {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result>(null);
  const [err, setErr] = useState("");

  const run = async () => {
    setLoading(true);
    setErr("");
    setRes(null);
    try {
      const r = await fetch("/api/verify-onchain");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "verification failed");
      setRes(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="glass-panel rounded-2xl p-4 border border-teal-500/30 bg-teal-500/5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-mono text-xs text-teal-300 font-bold uppercase tracking-wider mb-1">
            Real on-chain ZK — no wallet needed
          </p>
          <p className="text-gray-400 text-sm">
            Re-verify a real BN254 Groth16 solvency proof against the deployed
            oracle&rsquo;s{" "}
            <code className="text-teal-400">attest_reserves</code>, live on
            Testnet.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="text-xs font-semibold px-4 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "VERIFYING ON-CHAIN…" : "🔬 VERIFY A REAL PROOF ON-CHAIN"}
        </button>
      </div>

      {res && (
        <div className="mt-2 rounded-2xl p-4 border border-white/5 bg-gray-900/50 font-mono text-xs text-gray-400 space-y-1">
          <p>
            <span className="text-gray-500">
              real proof → attest_reserves ={" "}
            </span>
            <span
              className={res.valid_proof ? "text-emerald-400" : "text-red-400"}
            >
              {String(res.valid_proof)}
            </span>
          </p>
          <p>
            <span className="text-gray-500">
              tampered root → attest_reserves ={" "}
            </span>
            <span
              className={
                res.tampered_proof ? "text-red-400" : "text-emerald-400"
              }
            >
              {String(res.tampered_proof)}
            </span>
          </p>
          <a
            href={res.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-teal-400 hover:text-teal-300"
          >
            View oracle {res.verifier.slice(0, 6)}…{res.verifier.slice(-4)} on
            stellar.expert →
          </a>
        </div>
      )}
      {err && (
        <p className="mt-2 font-mono text-xs text-red-400">Error: {err}</p>
      )}
    </div>
  );
}
