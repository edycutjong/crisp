"use client";

import React from "react";
import { Cpu, Zap, Award } from "lucide-react";

export default function InstructionsChart() {
  const poseidonInst = 1482903;
  const shaInst = 12894019;
  const savings = 88.5;

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-brand-primary" />
          <h2 className="font-display text-xl font-bold text-white">
            ZK Circuit Hashing Cost (Poseidon vs SHA-256)
          </h2>
        </div>
        <Zap className="h-5 w-5 text-brand-accent animate-pulse" />
      </div>

      <div className="space-y-6">
        <p className="text-sm text-gray-400">
          Comparing in-circuit constraint cost (proving-side) for a depth-10
          Merkle-Sum Tree (1,024 accounts). On-chain verification is a constant
          BN254 pairing, independent of the hash.
        </p>

        {/* SHA-256 Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-gray-400">
              SHA-256 MST (Baseline)
            </span>
            <span className="font-mono text-gray-300">
              {(shaInst / 1000000).toFixed(2)}M constraints
            </span>
          </div>
          <div className="h-4 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{ width: "100%" }}
            ></div>
          </div>
        </div>

        {/* Poseidon Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-brand-primary">
              Poseidon MST (in-circuit)
            </span>
            <span className="font-mono text-brand-primary">
              {(poseidonInst / 1000000).toFixed(2)}M constraints
            </span>
          </div>
          <div className="h-4 w-full bg-gray-900 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-brand-primary to-brand-accent rounded-full transition-all duration-1000"
              style={{ width: `${(poseidonInst / shaInst) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Savings Metric badge */}
        <div className="mt-8 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              Poseidon circuit-constraint reduction: {savings}%
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Fewer circuit constraints mean faster client-side proof
              generation; on-chain, Crisp verifies a single constant-size BN254
              pairing regardless of the hash.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
