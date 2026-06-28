"use client";

import React from "react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-gray-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {/* Logo SVG */}
          <div className="h-9 w-9 rounded-lg bg-surface-secondary border border-white/10 flex items-center justify-center">
            <img src="/icon.svg" className="h-6 w-6" alt="Crisp Logo" />
          </div>
          <span className="font-display text-xl font-black tracking-tight text-white">
            CRISP
          </span>
        </div>

        <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-400">
          <a href="#about" className="hover:text-white transition-colors">
            How it Works
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#demo" className="hover:text-white transition-colors">
            Live Portal
          </a>
          <a href="#benchmarks" className="hover:text-white transition-colors">
            Gas Benchmarks
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-mono text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Stellar Testnet
          </div>
        </div>
      </div>
    </header>
  );
}
