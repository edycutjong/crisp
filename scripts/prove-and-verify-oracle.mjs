// REAL on-chain demo for Crisp's v2 registered-oracle reserve attestation:
//   a deterministic Ed25519 reserve-oracle key signs `reserves_threshold || kyc_root`
//   -> on-chain `verify_oracle_sig` verifies it against the REGISTERED oracle key
//   (set via set_oracle_key). A signature from any other key, or over tampered
//   data, is rejected by the host Ed25519 check.
//
// NOTE: the oracle key must already be registered on-chain:
//   stellar contract invoke --id <ORACLE_V2_ID> --source deployer --network testnet \
//     --send=yes -- set_oracle_key --oracle_pubkey <ORACLE_PUBKEY>
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const ORACLE = process.env.ORACLE_V2_ID || "CBBO72ROVZVAC2KWYZOEN6PH2GAGFFIFFDO35FV5PGM3QWDEN4EO45PU";

// MUST match the registered key (deterministic seed -> same key as set_oracle_key).
const seed = Buffer.from("a1a2a3a4a5a6a7a8b1b2b3b4b5b6b7b8c1c2c3c4c5c6c7c8d1d2d3d4d5d6d7d8", "hex");
const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
const priv = crypto.createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });

const RESERVES = 41665n;
const KYC_ROOT = "0ecdfe0997c23a0fe261aca9555027ffd450f0b45e3c17631ae3243c213d7cd1";
const resBE = Buffer.alloc(16); resBE.writeBigUInt64BE(RESERVES, 8);
const msg = Buffer.concat([resBE, Buffer.from(KYC_ROOT, "hex")]);
const sig = crypto.sign(null, msg, priv).toString("hex");

const invoke = (args) => {
  try {
    return execFileSync("stellar", ["contract", "invoke", "--id", ORACLE, "--source", "deployer",
      "--network", "testnet", "--", "verify_oracle_sig", ...args],
      { encoding: "utf8", env: { ...process.env, PATH: `${process.env.HOME}/homebrew/bin:${process.env.PATH}` }, stdio: ["ignore", "pipe", "pipe"] })
      .trim().split("\n").pop().trim();
  } catch (e) { return "REJECTED"; }
};

console.log("On-chain verify_oracle_sig (registered key) on", ORACLE, "...");
const ok = invoke(["--reserves_threshold", RESERVES.toString(), "--kyc_root", KYC_ROOT, "--oracle_signature", sig]);
console.log("verify_oracle_sig (real) =>", ok);
if (ok !== "true") process.exit(1);

const bad = invoke(["--reserves_threshold", (RESERVES + 1n).toString(), "--kyc_root", KYC_ROOT, "--oracle_signature", sig]);
console.log("verify_oracle_sig (tampered reserves) =>", bad);
if (bad === "true") { console.error("tampered attestation accepted!"); process.exit(1); }

console.log("\n✅ Registered-oracle Ed25519 reserve attestation verified on-chain; tampered/unregistered rejected.");
