// End-to-end REAL proving demo for Crisp's proof-of-solvency:
//   fresh random ledger (16 accounts) -> EdDSA-Poseidon sign the root ->
//   snarkjs groth16.fullProve (bn128) -> soroban bytes -> on-chain
//   attest_reserves (real BN254 pairing check, binds the issuer's signature).
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomInt } from "node:crypto";
import * as snarkjs from "snarkjs";
import { buildEddsa } from "circomlibjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const C = resolve(__dirname, "../circuits/build");
const ORACLE =
  process.env.ORACLE_ID ||
  "CDXROOACFGK7FIOMNRO22O25O5YIMSHA3DKEIQXUUWHR74QGVGKXXSOY";

const beHex = (dec, bytes) =>
  BigInt(dec)
    .toString(16)
    .padStart(bytes * 2, "0");
// BN254 (bn128) byte layout: G1 = be(X)||be(Y) (32+32); G2 Fp2 = be(c1)||be(c0).
const g1 = (p) => beHex(p[0], 32) + beHex(p[1], 32);
const g2 = (p) =>
  beHex(p[0][1], 32) +
  beHex(p[0][0], 32) +
  beHex(p[1][1], 32) +
  beHex(p[1][0], 32);

async function run() {
  // fresh random ledger
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

  // derive root + total via helper
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

  // Issuer signs the liabilities root with an EdDSA-Poseidon BabyJubjub key.
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
  console.log(
    `Generating real BN254 Groth16 solvency proof (EdDSA-signed; liabilities ${sum}, reserves ${reserves})...`,
  );
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    `${C}/solvency_js/solvency.wasm`,
    `${C}/s_final.zkey`,
  );
  const vk = (await import(`${C}/vk.json`, { with: { type: "json" } })).default;
  console.log(
    "off-chain verify:",
    await snarkjs.groth16.verify(vk, publicSignals, proof),
  );

  const proofHex = g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c);
  const rootHex = beHex(root, 32);
  const issuerAxHex = beHex(issuerAx, 32);
  const issuerAyHex = beHex(issuerAy, 32);

  console.log("Submitting on-chain attest_reserves to", ORACLE, "...");
  const out = execFileSync(
    "stellar",
    [
      "contract",
      "invoke",
      "--id",
      ORACLE,
      "--source",
      "deployer",
      "--network",
      "testnet",
      "--send=yes",
      "--",
      "attest_reserves",
      "--proof",
      proofHex,
      "--kyc_root",
      rootHex,
      "--total_liabilities",
      sum.toString(),
      "--reserves_threshold",
      reserves.toString(),
      "--issuer_ax",
      issuerAxHex,
      "--issuer_ay",
      issuerAyHex,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/homebrew/bin:${process.env.PATH}`,
      },
    },
  );
  const result = out.trim().split("\n").pop().trim();
  console.log("on-chain attest_reserves =>", result);
  if (result !== "true") process.exit(1);
  console.log("\n✅ JS-generated solvency proof attested on-chain.");
}
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(String(e).split("\n")[0]);
    process.exit(1);
  });
