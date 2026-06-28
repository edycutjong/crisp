"use client";

import React, { useState } from "react";
import {
  Search,
  UserCheck,
  AlertOctagon,
  RefreshCw,
  GitMerge,
  FileText,
} from "lucide-react";
import { MerkleSumTree } from "@/lib/merkleSumTree";
import { triggerConfetti } from "@/lib/confetti";

interface VerifyResult {
  kyc_root: string;
  account_address: string;
  balance: number;
  proof_path: Array<{ hash: string; sum: string; isRight: boolean }>;
  solvency_report: {
    total_liabilities: number;
    total_reserves: number;
    timestamp: string;
    tx_hash: string;
  };
}

export default function VerifyForm() {
  const [accountId, setAccountId] = useState(
    "GA111111111111111111111111111111111111111111111111111111",
  );
  const [balance, setBalance] = useState("100000");
  const [salt, setSalt] = useState("a3c1");
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [proofDetail, setProofDetail] = useState<VerifyResult | null>(null);
  const [localSteps, setLocalSteps] = useState<string[]>([]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setStatus("idle");
    setProofDetail(null);
    setLocalSteps(["[Local] Initializing verification engine..."]);

    try {
      // Fetch path and current attestation metadata from Supabase
      const res = await fetch(`/api/verify?accountId=${accountId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || "Failed to fetch inclusion proof path.",
        );
      }

      const data = await res.json();
      setProofDetail(data);

      setLocalSteps((prev) => [
        ...prev,
        `[Local] Retrieved proof path with ${data.proof_path.length} sibling nodes.`,
        `[Local] On-Chain Liabilities Root: ${data.kyc_root.substring(0, 16)}...`,
        `[Local] Computing leaf hash for account ${accountId.substring(0, 8)}...`,
      ]);

      // Verify the proof client-side
      const isVerified = await MerkleSumTree.verifyProof(
        data.kyc_root,
        BigInt(data.solvency_report.total_liabilities),
        accountId,
        BigInt(balance),
        salt,
        data.proof_path,
        true,
      );

      if (isVerified) {
        setLocalSteps((prev) => [
          ...prev,
          `[Local] Step 1: Leaf Hash verified.`,
          `[Local] Step 2: Parent sums matched all the way to Root.`,
          `[Local] Verification Success! User balance included in verified liabilities root.`,
        ]);
        setStatus("success");
        triggerConfetti();
      } else {
        throw new Error(
          "Verification failed. Re-computed root hash or liabilities sum does not match on-chain commitment!",
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      setLocalSteps((prev) => [...prev, `[ERROR] ${message}`]);
      setStatus("error");
      setErrorMsg(message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Search className="h-6 w-6 text-brand-primary" />
          <h2 className="font-display text-xl font-bold text-white">
            Public Verification Panel
          </h2>
        </div>
        <FileText className="h-5 w-5 text-gray-500" />
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Verify that your balance was included in the latest solvency report. The
        verification runs entirely in your browser using zero-knowledge inputs.
      </p>

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Stellar Public Key
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-gray-950 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-brand-primary outline-none"
              placeholder="e.g. GA111..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                USDC Balance
              </label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full bg-gray-950 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-brand-primary outline-none"
                placeholder="e.g. 100000"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Blinding Factor (Salt)
              </label>
              <input
                type="text"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                className="w-full bg-gray-950 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:border-brand-primary outline-none"
                placeholder="e.g. a3c1"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isValidating}
          className="w-full py-3 rounded-lg bg-brand-primary text-gray-950 font-bold hover:bg-brand-accent transition-all duration-normal flex items-center justify-center gap-2"
        >
          {isValidating ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Verifying Cryptographic Path...
            </>
          ) : (
            "Verify Inclusion"
          )}
        </button>
      </form>

      {localSteps.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Verification Logs
          </h4>
          <div className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1.5">
            {localSteps.map((step, index) => (
              <div
                key={index}
                className={
                  step.startsWith("[ERROR]")
                    ? "text-rose-500"
                    : step.includes("Success")
                      ? "text-emerald-400"
                      : "text-gray-300"
                }
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {status === "success" && proofDetail && (
        <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-start gap-3">
            <UserCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-white">
                Inclusion Verified!
              </div>
              <div className="text-gray-300 text-xs mt-1">
                Your account balance of{" "}
                <span className="font-mono text-emerald-300">
                  ${Number(balance).toLocaleString()} USDC
                </span>{" "}
                was successfully aggregated into the root liabilities sum of{" "}
                <span className="font-mono text-emerald-300">
                  $
                  {Number(
                    proofDetail.solvency_report.total_liabilities,
                  ).toLocaleString()}{" "}
                  USDC
                </span>
                .
              </div>
            </div>
          </div>

          {/* Interactive Tree visualization diagram */}
          <div className="mt-6 border border-white/5 bg-black/20 rounded-xl p-6 relative overflow-hidden flex flex-col items-center">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-6 self-start flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-brand-primary" />
              Inclusion Proof Visualizer
            </h4>

            {/* Visual Root */}
            <div className="z-10 bg-slate-900 border border-emerald-500 rounded-lg p-3 text-center w-52 shadow-emerald-500/10 shadow-lg">
              <div className="text-[10px] text-emerald-400 font-bold tracking-wider">
                ROOT COMMITMENT
              </div>
              <div className="font-mono text-xs text-white truncate mt-1">
                {proofDetail.kyc_root.substring(0, 16)}...
              </div>
              <div className="font-mono text-xs text-emerald-400 font-bold mt-1">
                $
                {Number(
                  proofDetail.solvency_report.total_liabilities,
                ).toLocaleString()}{" "}
                USDC
              </div>
            </div>

            {/* Path Arrow */}
            <div className="h-12 w-0.5 bg-linear-to-b from-emerald-500 to-brand-primary my-2"></div>

            {/* Sibling Info & Leaf */}
            <div className="flex gap-12 items-center justify-center w-full max-w-md">
              <div className="bg-slate-900/50 border border-white/5 rounded-lg p-2.5 text-center w-40">
                <div className="text-[9px] text-gray-500 font-bold">
                  SIBLING MERKLE PATH
                </div>
                <div className="font-mono text-[10px] text-gray-400 truncate mt-0.5">
                  {proofDetail.proof_path[0]?.hash.substring(0, 10)}...
                </div>
                <div className="font-mono text-xs text-brand-primary mt-0.5">
                  ${Number(proofDetail.proof_path[0]?.sum).toLocaleString()}{" "}
                  USDC
                </div>
              </div>

              <div className="z-10 bg-slate-900 border border-brand-primary rounded-lg p-3 text-center w-48 shadow-brand-primary/10 shadow-lg">
                <div className="text-[9px] text-brand-primary font-bold">
                  YOUR VERIFIED LEAF
                </div>
                <div className="font-mono text-[10px] text-white truncate mt-1">
                  {proofDetail.account_address.substring(0, 12)}...
                </div>
                <div className="font-mono text-xs text-brand-primary font-bold mt-1">
                  ${Number(balance).toLocaleString()} USDC
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-white">Verification Failed</div>
            <div className="text-gray-300 text-xs mt-1">{errorMsg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
