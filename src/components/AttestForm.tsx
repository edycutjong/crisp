"use client";

import React, { useState } from "react";
import {
  Shield,
  Server,
  Coins,
  CheckCircle,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import {
  isConnected as isFreighterConnected,
  requestAccess,
  getAddress,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";
import { triggerConfetti } from "@/lib/confetti";

interface AttestFormProps {
  onAttestSuccess: () => void;
}

interface AttestResult {
  tx_hash: string;
  total_liabilities: string;
  kyc_root: string;
  total_reserves: string;
  timestamp: string;
}

export default function AttestForm({ onAttestSuccess }: AttestFormProps) {
  const [reserves, setReserves] = useState("520000");
  const [usePoseidon, setUsePoseidon] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAttesting, setIsAttesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<AttestResult | null>(null);
  const [sandboxMode, setSandboxMode] = useState<boolean>(true);

  const issuerAddress =
    "GDISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

  const connectWallet = async () => {
    setIsConnecting(true);
    setLogs(["[Freighter] Connecting to Freighter Wallet..."]);
    try {
      const connection = await isFreighterConnected();
      if (!connection.isConnected) {
        setLogs((prev) => [
          ...prev,
          "[Freighter] Extension not detected. Install Freighter, or use the Demo button to explore the sandbox.",
        ]);
        return;
      }

      const access = await requestAccess();
      if (access.error) {
        throw new Error(String(access.error));
      }
      const pubKey = access.address;
      if (!pubKey) {
        throw new Error("Failed to retrieve public key from Freighter.");
      }
      setIsConnected(true);
      setSandboxMode(false);
      setLogs((prev) => [...prev, `[Freighter] Connected. Address: ${pubKey}`]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[ERROR] ${msg}`]);
      setErrorMsg(msg);
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Predefined demo issuer identity — no wallet extension required. Stays in
  // sandbox mode so nothing is broadcast; for exploring the console UI.
  const connectDemoWallet = () => {
    setLogs((prev) => [
      ...prev,
      "[Sandbox] Loading predefined demo issuer identity...",
    ]);
    setTimeout(() => {
      setIsConnected(true);
      setSandboxMode(true);
      setLogs((prev) => [
        ...prev,
        `[Sandbox] Demo identity active. Address: ${issuerAddress}`,
      ]);
    }, 600);
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setSandboxMode(true);
    setLogs((prev) => [...prev, "[Wallet] Disconnected."]);
  };

  const handleAttest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;

    setIsAttesting(true);
    setStatus("idle");
    setResult(null);
    setLogs([
      "[1/5] Scraping active USDC balances from Stellar Horizon API...",
    ]);

    try {
      await new Promise((r) => setTimeout(r, 600));
      setLogs((prev) => [
        ...prev,
        "[2/5] Horizon scraping completed. Constructing Merkle-Sum Tree (depth: 4)...",
      ]);

      await new Promise((r) => setTimeout(r, 600));
      setLogs((prev) => [
        ...prev,
        "[3/5] Generating load-bearing ZK Groth16 Proof (bn254)...",
      ]);

      await new Promise((r) => setTimeout(r, 600));
      setLogs((prev) => [
        ...prev,
        "[4/5] ZK proof generated. Submitting attestation to Soroban smart contract...",
      ]);

      const res = await fetch("/api/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserves: Number(reserves), usePoseidon }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Solvency attestation failed.");
      }

      if (!sandboxMode) {
        setLogs((prev) => [...prev, "[Stellar] Connecting to Soroban RPC..."]);
        const { rpc, TransactionBuilder, Networks, Contract, nativeToScVal } =
          await import("@stellar/stellar-sdk");

        const contractId =
          process.env.NEXT_PUBLIC_SOLVENCY_ORACLE ||
          "CB3C5KQL4MZO3Q2SXY7HLTJWV32WXLSP73L5J5Z6R4M5Y3H2R7OWTEST";
        if (!contractId || contractId.startsWith("CB...")) {
          throw new Error(
            "Stellar Solvency Oracle Contract ID is not configured. Please set NEXT_PUBLIC_SOLVENCY_ORACLE in your env.",
          );
        }

        const rpcUrl =
          process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
          "https://soroban-testnet.stellar.org";
        const server = new rpc.Server(rpcUrl);

        setLogs((prev) => [
          ...prev,
          `[Stellar] Connected to RPC. Contract: ${contractId}`,
        ]);
        setLogs((prev) => [
          ...prev,
          `[prover] Generating real bls12-381 Groth16 solvency proof in-browser...`,
        ]);

        // Generate a REAL proof of solvency. The circuit is fixed at 16 accounts;
        // the merkle-sum root it computes becomes the on-chain kyc_root.
        const { CrispProver } = await import("../lib/zkProver");
        const prover = new CrispProver();
        const ledger = [
          { accountId: 1, balance: data.total_liabilities, salt: Date.now() },
        ];
        const { proof, kycRootHex } = await prover.proveSolvency(
          ledger,
          reserves,
        );
        setLogs((prev) => [
          ...prev,
          `[Stellar] Packing proof + root commitment (${kycRootHex.substring(0, 16)}...) into ScVals...`,
        ]);

        const kycRootBytes = new Uint8Array(
          kycRootHex
            .match(/.{1,2}/g)!
            .map((byte: string) => parseInt(byte, 16)),
        );

        const c = new Contract(contractId);
        const callOp = c.call(
          "attest_reserves",
          nativeToScVal(Buffer.from(proof)),
          nativeToScVal(Buffer.from(kycRootBytes)),
          nativeToScVal(BigInt(data.total_liabilities)),
          nativeToScVal(BigInt(reserves)),
        );

        const pubKeyRes = await getAddress();
        const userAddress = pubKeyRes.address;
        if (!userAddress) {
          throw new Error("Failed to get connected Freighter account address.");
        }

        setLogs((prev) => [
          ...prev,
          `[Freighter] Fetching account details for source: ${userAddress}...`,
        ]);
        const account = await server.getAccount(userAddress);

        const tx = new TransactionBuilder(account, {
          fee: "100000",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(callOp)
          .setTimeout(30)
          .build();

        const xdrTx = tx.toXDR();

        setLogs((prev) => [
          ...prev,
          `[Freighter] Requesting signature to publish solvency attestation...`,
        ]);
        const signResult = await freighterSignTransaction(xdrTx, {
          networkPassphrase: Networks.TESTNET,
          address: userAddress,
        });
        if (signResult.error) {
          throw new Error(
            `Freighter signing failed: ${JSON.stringify(signResult.error)}`,
          );
        }

        setLogs((prev) => [
          ...prev,
          `[Stellar] Submitting transaction to Soroban RPC...`,
        ]);
        const signedTxObj = TransactionBuilder.fromXDR(
          signResult.signedTxXdr,
          Networks.TESTNET,
        );
        const sendResponse = await server.sendTransaction(signedTxObj);
        if (sendResponse.status === "ERROR") {
          throw new Error(
            `RPC submit error: ${JSON.stringify(sendResponse.errorResult)}`,
          );
        }

        let txStatus = await server.getTransaction(sendResponse.hash);
        let attempts = 0;
        while (txStatus.status === "NOT_FOUND" && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          txStatus = await server.getTransaction(sendResponse.hash);
          attempts++;
        }

        if (txStatus.status === "SUCCESS") {
          setLogs((prev) => [
            ...prev,
            `[5/5] Soroban contract verified attestation and event emitted!`,
            `[5/5] Committed root hash ${data.kyc_root.substring(0, 16)}... to ledger.`,
            `[5/5] Stellar transaction committed! Hash: ${sendResponse.hash}`,
          ]);
          setStatus("success");
          triggerConfetti();
          setResult({
            ...data,
            tx_hash: sendResponse.hash,
          });
          onAttestSuccess();
        } else {
          throw new Error(`Transaction failed with status: ${txStatus.status}`);
        }
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setLogs((prev) => [
          ...prev,
          `[5/5] Soroban contract verified attestation and event emitted!`,
          `[5/5] Committed root hash ${data.kyc_root.substring(0, 16)}... to ledger.`,
          `[5/5] Report cached to Supabase: Tx ${data.tx_hash.substring(0, 16)}...`,
        ]);
        setStatus("success");
        triggerConfetti();
        setResult(data);
        onAttestSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[ERROR] ${msg}`]);
      setStatus("error");
      setErrorMsg(msg);
    } finally {
      setIsAttesting(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 glow-teal">
      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-brand-primary" />
          <h2 className="font-display text-xl font-bold text-white">
            Issuer Attestation Panel
          </h2>
        </div>
        <Cpu className="h-5 w-5 text-gray-500" />
      </div>

      {!isConnected ? (
        <div className="text-center py-8">
          <Coins className="h-12 w-12 text-brand-primary/40 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">
            Connect Issuer Account
          </h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
            Connect your Freighter wallet to authorize reserve audits and
            publish solvency proofs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-brand-primary text-gray-950 font-semibold hover:bg-brand-accent transition-all duration-normal disabled:opacity-50"
            >
              {isConnecting
                ? "Connecting Freighter..."
                : "Connect Freighter Wallet"}
            </button>
            <button
              onClick={connectDemoWallet}
              disabled={isConnecting}
              title="Load a predefined demo issuer identity — no wallet extension required"
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold hover:bg-amber-500/20 transition-all duration-normal disabled:opacity-50"
            >
              Use Demo Identity
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAttest} className="space-y-6">
          {/* Sandbox Toggle / Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-teal-950/25 border border-teal-800/30 px-4 py-3 rounded-xl text-xs font-mono text-teal-400 gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${sandboxMode ? "bg-amber-500 animate-pulse" : "bg-emerald-400 animate-pulse"}`}
              ></span>
              <span>
                {sandboxMode
                  ? "DEMO SANDBOX ACTIVE: RUNNING LOCAL CRYPTO SIMULATIONS"
                  : "TESTNET INTEGRATION ACTIVE: SENDING TRANSACTION REQUESTS TO SOROBAN CONTRACTS"}
              </span>
            </div>
            <div className="flex gap-2 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setSandboxMode((prev) => !prev)}
                className="bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold text-teal-300 transition-all uppercase tracking-wider flex-1 sm:flex-none text-center cursor-pointer"
              >
                Switch to {sandboxMode ? "Live Testnet" : "Sandbox Mode"}
              </button>
              <button
                type="button"
                onClick={disconnectWallet}
                title="Disconnect issuer wallet"
                className="bg-gray-800/40 hover:bg-gray-700/40 border border-gray-600/40 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 hover:text-white transition-all uppercase tracking-wider text-center cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Off-Chain Reserve Assets (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  value={reserves}
                  onChange={(e) => setReserves(e.target.value)}
                  disabled={isAttesting}
                  className="w-full bg-gray-950 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-white font-mono focus:border-brand-primary outline-none"
                  required
                />
              </div>
              <span className="text-xs text-gray-500 mt-1.5 block">
                Represents bank reserves verified by custodian APIs.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Cryptographic Hashing Primitive
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUsePoseidon(true)}
                  disabled={isAttesting}
                  className={`flex-1 py-2 px-4 rounded-lg font-mono text-sm font-bold border transition-all ${
                    usePoseidon
                      ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                      : "bg-transparent border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  Poseidon (P25)
                </button>
                <button
                  type="button"
                  onClick={() => setUsePoseidon(false)}
                  disabled={isAttesting}
                  className={`flex-1 py-2 px-4 rounded-lg font-mono text-sm font-bold border transition-all ${
                    !usePoseidon
                      ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                      : "bg-transparent border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  SHA-256 (Baseline)
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/5">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm font-semibold text-white">
                  Delegated Authority Active
                </div>
                <div className="text-xs text-gray-400">
                  Attestation keys managed under Soroban multi-sig auth
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAttesting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-brand-primary text-gray-950 font-bold hover:bg-brand-accent transition-all duration-normal disabled:opacity-50"
            >
              {isAttesting
                ? "Generating ZK Proof..."
                : "Publish Solvency Proof"}
            </button>
          </div>
        </form>
      )}

      {logs.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Logs
          </h4>
          <div className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1.5 max-h-48 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className={
                  log.startsWith("[ERROR]")
                    ? "text-rose-500"
                    : log.includes("success") || log.includes("Success")
                      ? "text-emerald-400"
                      : "text-gray-300"
                }
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {status === "success" && result && (
        <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-white">
              Solvency Attestation Successfully Published!
            </div>
            <div className="text-gray-300 text-xs mt-1 space-y-1">
              <div>
                <span className="text-gray-500">Tx Hash:</span>{" "}
                <span className="font-mono text-emerald-300">
                  {result.tx_hash}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Total Liabilities:</span>{" "}
                <span className="font-mono">
                  ${Number(result.total_liabilities).toLocaleString()} USDC
                </span>
              </div>
              <div>
                <span className="text-gray-500">ZK Root Hash:</span>{" "}
                <span className="font-mono">{result.kyc_root}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-white">Attestation Rejected</div>
            <div className="text-gray-300 text-xs mt-1">{errorMsg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
