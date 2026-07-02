// Generates a REAL BN254 Groth16 solvency proof (identical pipeline to
// prove-and-verify.mjs) and confirms attest_reserves returns TRUE on the
// deployed oracle via read-only JS simulation, then writes it as a static
// fixture the web app re-verifies on-chain live.
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import * as snarkjs from "snarkjs";
import { buildEddsa } from "circomlibjs";
import {
  rpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  Account,
  scValToNative,
} from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const C = resolve(__dirname, "../circuits/build");
const OUT = resolve(__dirname, "../src/app/api/verify-onchain/proof.json");
const ORACLE =
  process.env.ORACLE_ID ||
  "CDXROOACFGK7FIOMNRO22O25O5YIMSHA3DKEIQXUUWHR74QGVGKXXSOY";

const beHex = (dec, bytes) =>
  BigInt(dec)
    .toString(16)
    .padStart(bytes * 2, "0");
const g1 = (p) => beHex(p[0], 32) + beHex(p[1], 32);
const g2 = (p) =>
  beHex(p[0][1], 32) +
  beHex(p[0][0], 32) +
  beHex(p[1][1], 32) +
  beHex(p[1][0], 32);

function attestCall(contract, f) {
  return contract.call(
    "attest_reserves",
    nativeToScVal(Buffer.from(f.proofHex, "hex")),
    nativeToScVal(Buffer.from(f.kycRootHex, "hex")),
    nativeToScVal(BigInt(f.totalLiabilities), { type: "u128" }),
    nativeToScVal(BigInt(f.reservesThreshold), { type: "u128" }),
    nativeToScVal(Buffer.from(f.issuerAxHex, "hex")),
    nativeToScVal(Buffer.from(f.issuerAyHex, "hex")),
  );
}

async function run() {
  const ids = [],
    balances = [],
    salts = [];
  let sum = 0n;
  for (let i = 0; i < 16; i++) {
    const bal = randomInt(1, 1_000_000);
    ids.push(String(i + 1));
    balances.push(String(bal));
    salts.push(String(randomInt(1, 1e9)));
    sum += BigInt(bal);
  }
  const reserves = sum + BigInt(randomInt(1, 1_000_000)); // solvent

  execFileSync(
    "node",
    [
      `${C}/gen_solvency_js/generate_witness.js`,
      `${C}/gen_solvency_js/gen_solvency.wasm`,
      "/dev/stdin",
      `${C}/_g.wtns`,
    ],
    { input: JSON.stringify({ accountIds: ids, balances, salts }) },
  );
  execSync(`npx snarkjs wtns export json ${C}/_g.wtns ${C}/_g.json`, {
    stdio: "ignore",
  });
  const w = (await import(`${C}/_g.json`, { with: { type: "json" } })).default;
  const root = w[1].toString();

  const eddsa = await buildEddsa();
  const F = eddsa.F;
  const prvKey = Buffer.from(
    "0001020304050607080900010203040506070809000102030405060708090001",
    "hex",
  );
  const pubKey = eddsa.prv2pub(prvKey);
  const sig = eddsa.signPoseidon(prvKey, F.e(root));
  const issuerAx = F.toObject(pubKey[0]).toString();
  const issuerAy = F.toObject(pubKey[1]).toString();

  const input = {
    expectedLiabilitiesRoot: root,
    expectedLiabilitiesSum: sum.toString(),
    reserves: reserves.toString(),
    issuerAx,
    issuerAy,
    accountIds: ids,
    balances,
    salts,
    sigS: sig.S.toString(),
    sigR8x: F.toObject(sig.R8[0]).toString(),
    sigR8y: F.toObject(sig.R8[1]).toString(),
  };
  console.log("Generating real BN254 Groth16 solvency proof...");
  const { proof } = await snarkjs.groth16.fullProve(
    input,
    `${C}/solvency_js/solvency.wasm`,
    `${C}/s_final.zkey`,
  );

  const fixture = {
    _comment:
      "Real BN254 Groth16 solvency proof (snarkjs, EdDSA-signed root). Re-verified live on-chain by /api/verify-onchain.",
    verifier: ORACLE,
    entrypoint: "attest_reserves",
    proofHex: g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c),
    kycRootHex: beHex(root, 32),
    totalLiabilities: sum.toString(),
    reservesThreshold: reserves.toString(),
    issuerAxHex: beHex(issuerAx, 32),
    issuerAyHex: beHex(issuerAy, 32),
  };

  const server = new rpc.Server("https://soroban-testnet.stellar.org");
  const contract = new Contract(ORACLE);
  const source = "GAZV4ZZRKEWHOHWSVKLX7VZVDGJ6GAVSPHMFDBYMS6WQ74DBYP3FOMMX";
  const tx = new TransactionBuilder(new Account(source, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(attestCall(contract, fixture))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  const onchain =
    rpc.Api.isSimulationSuccess(sim) &&
    String(scValToNative(sim.result.retval)) === "true";
  console.log("on-chain attest_reserves =>", onchain);
  if (!onchain) throw new Error("fixture proof did not attest true on-chain");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(fixture, null, 2) + "\n");
  console.log("Wrote fixture ->", OUT);
}
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
