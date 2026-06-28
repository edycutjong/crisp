"use client";

import React from "react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-gray-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {/* Logo SVG */}
          <div className="h-9 w-9 rounded-lg bg-surface-secondary border border-white/10 flex items-center justify-center">
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
                <circle cx="128" cy="80" r="24" fill="#10b981" />
              </g>
            </svg>
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
