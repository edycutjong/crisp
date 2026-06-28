// End-to-end REAL proving demo for Crisp's v3 batch multi-issuer solvency:
//   aggregator circuit (circuits/aggregator.circom) over 4 issuers ->
//   snarkjs groth16.fullProve (bn128) -> soroban bytes -> on-chain
//   verify_batch_proof (real BN254 pairing check against the batch VK).
//   Tampered public inputs are rejected.
//
// snarkjs publicSignals order:
//   [ batch_root (output), total_system_liabilities, total_system_reserves ]
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as snarkjs from "snarkjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const C = resolve(__dirname, "../circuits/build");
const ORACLE =
  process.env.BATCH_ORACLE_ID ||
  "CANW4N5YTB4UYDM4MO5WK5SUHGPLJBXG3FQATLZQ5QKAQ2A57TXQ2DL2";

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

async function run() {
  // 4 issuers, each individually solvent; system solvent overall.
  const issuer_roots = ["11", "22", "33", "44"];
  const issuer_liabilities = ["1000", "2000", "1500", "2500"]; // sum = 7000
  const issuer_reserves = ["1200", "2200", "1800", "3000"]; // sum = 8200
  const total_system_liabilities = "7000";
  const total_system_reserves = "8200";

  const input = {
    total_system_liabilities,
    total_system_reserves,
    issuer_roots,
    issuer_liabilities,
    issuer_reserves,
  };

  console.log(
    `Generating real BN254 Groth16 batch proof (4 issuers; sys liabilities ${total_system_liabilities}, reserves ${total_system_reserves})...`,
  );
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    `${C}/aggregator_js/aggregator.wasm`,
    `${C}/agg_final.zkey`,
  );
  const vk = (await import(`${C}/agg_vk.json`, { with: { type: "json" } }))
    .default;
  console.log(
    "off-chain verify:",
    await snarkjs.groth16.verify(vk, publicSignals, proof),
  );

  const proofHex = g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c);
  const batchRootHex = beHex(publicSignals[0], 32);
  const liab = publicSignals[1];
  const res = publicSignals[2];

  const invoke = (args) =>
    execFileSync(
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
        ...args,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/homebrew/bin:${process.env.PATH}`,
        },
      },
    )
      .trim()
      .split("\n")
      .pop()
      .trim();

  console.log("Submitting on-chain verify_batch_proof to", ORACLE, "...");
  const result = invoke([
    "--",
    "verify_batch_proof",
    "--proof",
    proofHex,
    "--batch_root",
    batchRootHex,
    "--total_system_liabilities",
    liab,
    "--total_system_reserves",
    res,
  ]);
  console.log("on-chain verify_batch_proof =>", result);
  if (result !== "true") process.exit(1);

  // negative control: tamper total_system_liabilities -> must be rejected
  const tampered = invoke([
    "--",
    "verify_batch_proof",
    "--proof",
    proofHex,
    "--batch_root",
    batchRootHex,
    "--total_system_liabilities",
    String(BigInt(liab) + 1n),
    "--total_system_reserves",
    res,
  ]);
  console.log("on-chain verify_batch_proof (tampered) =>", tampered);
  if (tampered === "true") {
    console.error("tampered proof accepted!");
    process.exit(1);
  }

  console.log(
    "\n✅ Real BN254 Groth16 batch multi-issuer solvency proof verified on-chain; tampered proof rejected.",
  );
}
run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(String(e).split("\n")[0]);
    process.exit(1);
  });
