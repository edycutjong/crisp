import { NextResponse } from "next/server";
import {
  rpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Account,
  scValToNative,
} from "@stellar/stellar-sdk";
import fixture from "./proof.json";

// Re-verifies a REAL BN254 Groth16 solvency proof against the deployed oracle's
// attest_reserves (real pairing + EdDSA issuer-signature check) via read-only
// simulation — no wallet, no fee, nothing submitted. Real proof => true;
// a tampered liabilities root => rejected. Witnessable in the browser.

export const dynamic = "force-dynamic";

const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";
const VERIFIER = fixture.verifier;
const SOURCE = "GAZV4ZZRKEWHOHWSVKLX7VZVDGJ6GAVSPHMFDBYMS6WQ74DBYP3FOMMX";

async function attest(kycRootHex: string): Promise<boolean> {
  const server = new rpc.Server(RPC_URL, {
    allowHttp: RPC_URL.startsWith("http://"),
  });
  const contract = new Contract(VERIFIER);
  const call = contract.call(
    "attest_reserves",
    nativeToScVal(Buffer.from(fixture.proofHex, "hex")),
    nativeToScVal(Buffer.from(kycRootHex, "hex")),
    nativeToScVal(BigInt(fixture.totalLiabilities), { type: "u128" }),
    nativeToScVal(BigInt(fixture.reservesThreshold), { type: "u128" }),
    nativeToScVal(Buffer.from(fixture.issuerAxHex, "hex")),
    nativeToScVal(Buffer.from(fixture.issuerAyHex, "hex")),
  );
  const tx = new TransactionBuilder(new Account(SOURCE, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(call)
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return false;
  return String(scValToNative(sim.result.retval)) === "true";
}

export async function GET() {
  const root = fixture.kycRootHex;
  const tamperedRoot =
    root.slice(0, -2) + (root.slice(-2) === "00" ? "01" : "00");

  try {
    const [validProof, tamperedProof] = await Promise.all([
      attest(root),
      attest(tamperedRoot),
    ]);
    return NextResponse.json({
      network: "testnet",
      verifier: VERIFIER,
      entrypoint: "attest_reserves",
      valid_proof: validProof,
      tampered_proof: tamperedProof,
      explorer: `https://stellar.expert/explorer/testnet/contract/${VERIFIER}`,
      note: "Real snarkjs BN254 Groth16 solvency proof, re-verified live on the deployed Soroban oracle by read-only simulation. A tampered liabilities root is rejected.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
