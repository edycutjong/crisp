"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import VerifyForm from "@/components/VerifyForm";
import AttestForm from "@/components/AttestForm";
import InstructionsChart from "@/components/InstructionsChart";
import {
  HelpCircle,
  ChevronDown,
  CheckCircle,
  GitCommit,
  FileSpreadsheet,
  Lock,
} from "lucide-react";

export default function Home() {
  const [liabilities, setLiabilities] = useState(500000);
  const [reserves, setReserves] = useState(520000);
  const [lastAttested, setLastAttested] = useState("Just now");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleAttestSuccess = () => {
    // When a new attestation succeeds, pull the latest data from the API
    fetchLatestStats();
  };

  const fetchLatestStats = async () => {
    try {
      const res = await fetch("/api/integrations/verify");
      const data = await res.json();
      if (data.latest_proof && data.latest_proof.verified) {
        setLiabilities(Number(data.latest_proof.total_liabilities));
        setReserves(Number(data.latest_proof.total_reserves));

        const date = new Date(data.latest_proof.timestamp * 1000);
        setLastAttested(date.toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to load telemetry stats:", err);
    }
  };

  useEffect(() => {
    fetchLatestStats();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does Crisp prove solvency without revealing total reserves?",
      a: "Crisp uses Zero-Knowledge range constraints (LessEqThan). The circuit takes the private inputs (reserve amount $R$, liabilities tree leaves) and constraints $R \\ge L$, where $L$ is the sum of liabilities. It only outputs a binary true/false public commitment, keeping both the exact reserves and liabilities hidden from the public ledger.",
    },
    {
      q: "What is a Merkle-Sum Tree?",
      a: "A Merkle-Sum Tree is a specialized Merkle tree where each node contains both a hash commitment and a sum value. Each parent node's sum is the exact summation of its children's sums. This guarantees that the root sum represents the exact total of all user balances, making it impossible for an issuer to selectively omit customer liabilities.",
    },
    {
      q: "How do I know my balance wasn't omitted by the issuer?",
      a: "You can enter your public address, balance, and salt in our Public Verification Panel. The client re-calculates your leaf hash and aggregates the sibling nodes from the proof path. If the final hash and sum match the on-chain liabilities root commitment, your balance is cryptographically guaranteed to be included in the solvency pool.",
    },
    {
      q: "Why is Poseidon2 used instead of SHA-256?",
      a: "SHA-256 requires intensive Boolean constraints inside ZK circuits, inflating constraint size and on-chain verification gas. Poseidon2 is designed specifically for elliptic curve arithmetic. Using Stellar Protocol 25's native Poseidon2 host functions reduces Soroban execution instructions by over 88%.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      {/* CRISP animated background */}
      <div className="crisp-grid-bg"></div>
      <div className="crisp-nodes"></div>
      <div className="crisp-scanline"></div>
      <Navbar />

      {/* Grid background effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c1020_1px,transparent_1px),linear-gradient(to_bottom,#0c1020_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      <main className="grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-xs font-semibold text-brand-primary">
            <Lock className="h-3.5 w-3.5" />
            Zero-Knowledge Proof of Reserves &amp; Solvency Oracle
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-black tracking-tight text-white leading-none">
            Solvency. Proven in{" "}
            <span className="text-gradient">Real-Time.</span>
          </h1>
          <p className="text-lg text-gray-400">
            Cryptographically prove that stablecoin reserves exceed customer
            liabilities on Stellar without unmasking individual balances or
            exposing proprietary reserve totals.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <a
              href="https://github.com/edycutjong/crisp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              GitHub Repository
            </a>
            <a
              href="/pitch.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 text-sm font-semibold text-teal-400 hover:bg-teal-500/20 transition"
            >
              View Pitch Deck
            </a>
          </div>
        </section>

        {/* Global Solvency Status Header */}
        <section className="glass-panel rounded-2xl p-6 md:p-8 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="flex flex-col gap-2 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Solvency Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
                <span className="font-display text-xl font-bold text-emerald-400">
                  SOLVENT &amp; ACTIVE
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-mono">
                Verified: {lastAttested}
              </span>
            </div>

            <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Liabilities
              </span>
              <span className="font-mono text-2xl font-bold text-white">
                ${liabilities.toLocaleString()}{" "}
                <span className="text-xs text-gray-500">USDC</span>
              </span>
              <span className="text-[10px] text-gray-500">
                Sum of all user balances
              </span>
            </div>

            <div className="flex flex-col gap-1 border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Verified Reserves
              </span>
              <span className="font-mono text-2xl font-bold text-brand-primary">
                ${reserves.toLocaleString()}{" "}
                <span className="text-xs text-gray-500">USD</span>
              </span>
              <span className="text-[10px] text-gray-500">
                Custodian confirmed bank balance
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Solvency Cushion
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-400">
                +${(reserves - liabilities).toLocaleString()}{" "}
                <span className="text-xs text-gray-500">USD</span>
              </span>
              <span className="text-[10px] text-gray-500">
                Buffer asset value
              </span>
            </div>
          </div>
        </section>

        {/* Core Split Screen Portal & Issuer Portal */}
        <section
          id="demo"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
        >
          <VerifyForm />
          <AttestForm onAttestSuccess={handleAttestSuccess} />
        </section>

        {/* Telemetry Chart & Features Section */}
        <section
          id="benchmarks"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2">
            <InstructionsChart />
          </div>

          <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-brand-primary" />
                ZK Oracle Security Invariants
              </h3>
              <ul className="space-y-4 text-sm text-gray-400">
                <li className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>
                    <b>Balance Integrity</b>: Ensures individual user balances
                    cannot be negative.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>
                    <b>Verification Invariant</b>: Attestations fail
                    automatically if liabilities &gt; reserves.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>
                    <b>Zero Knowledge</b>: Public users cannot scan overall
                    reserve balances or competitor positions.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-brand-primary" />
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Latest Root Commit
                  </div>
                  <div className="font-mono text-xs text-white truncate max-w-[180px]">
                    ce0c91e8487da3df68c969baf128f766474a5d2c7f1e954acc6dbf3460600de2
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="about" className="max-w-3xl mx-auto space-y-6">
          <h2 className="font-display text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
            <HelpCircle className="h-6 w-6 text-brand-primary" />
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="glass-panel rounded-xl border-white/5 overflow-hidden transition-all duration-normal"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-white hover:bg-white/5 transition-colors outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${openFaq === index ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === index && (
                  <div className="p-5 pt-0 text-sm text-gray-400 border-t border-white/5 bg-black/10 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="glass-panel rounded-2xl p-8 md:p-12 border-white/5 text-center space-y-6 max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-60 w-60 bg-brand-primary/10 rounded-full blur-3xl -z-10" />
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
            Secure Your Issuer Trust Ecosystem
          </h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto">
            Ready to integrate Crisp with your stablecoin reserves? Deploy the
            solvency oracle contract on Stellar testnet today.
          </p>
          <a
            href="https://github.com/edycutjong/hermes-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-6 py-2.5 rounded-lg bg-brand-primary text-gray-950 font-bold hover:bg-brand-accent transition-all duration-normal"
          >
            Get the SDK &amp; Contract
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-gray-950 py-12 mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-6 w-6 text-brand-primary"
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g transform="translate(128, 112)">
                  <path
                    d="M 128,0 L 220,38 L 256,128 L 220,218 L 128,256 L 36,218 L 0,128 L 36,38 Z"
                    stroke="currentColor"
                    strokeWidth="20"
                    strokeLinejoin="round"
                  />
                </g>
              </svg>
              <span className="font-display font-bold text-white">CRISP</span>
            </div>
            <p className="text-xs text-gray-500">
              ZK Proof-of-Reserves solvency checking protocol for Stellar smart
              networks.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs text-gray-500">
              <li>
                <a
                  href="https://stellar.org"
                  className="hover:text-white transition-colors"
                >
                  Stellar.org
                </a>
              </li>
              <li>
                <a
                  href="https://soroban.stellar.org"
                  className="hover:text-white transition-colors"
                >
                  Soroban SDK
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/stellar/soroban-examples"
                  className="hover:text-white transition-colors"
                >
                  Soroban Examples
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Security
            </h4>
            <ul className="space-y-2 text-xs text-gray-500">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  Audit Invariants
                </a>
              </li>
              <li>
                <a
                  href="https://circom.io"
                  className="hover:text-white transition-colors"
                >
                  Circom Cryptography
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Developer
            </h4>
            <p className="text-xs text-gray-500 leading-normal">
              Crisp is open-source. Build verification pipelines natively under
              Stellar Protocol 25/26 specifications.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 border-t border-white/5 mt-8 pt-8 text-center text-[10px] text-gray-600">
          &copy; 2026 Crisp solvency project. Built for the Stellar Hacks:
          Real-World ZK Hackathon.
        </div>
      </footer>
    </div>
  );
}
