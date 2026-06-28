import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const C = resolve(__dirname, "../circuits/build");
const ORACLE = "CDXROOACFGK7FIOMNRO22O25O5YIMSHA3DKEIQXUUWHR74QGVGKXXSOY";

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
  const vk = (await import(`${C}/vk.json`, { with: { type: "json" } })).default;

  const alpha = g1(vk.vk_alpha_1);
  const beta = g2(vk.vk_beta_2);
  const gamma = g2(vk.vk_gamma_2);
  const delta = g2(vk.vk_delta_2);
  const ic = vk.IC.map((p) => g1(p));

  const STELLAR_BIN = "/Users/edycu/homebrew/bin/stellar";

  console.log("Initializing Oracle...");
  try {
    execSync(
      `${STELLAR_BIN} contract invoke --id ${ORACLE} --source deployer --network testnet --send=yes -- initialize --admin 0000000000000000000000000000000000000000000000000000000000000000`,
      { stdio: "inherit" },
    );
  } catch (e) {
    console.log(
      "Initialization skipped or failed (possibly already initialized):",
      e.message,
    );
  }

  console.log("Setting Verification Key...");

  // Format the ic argument for the stellar CLI. Soroban expects a Vec of Bytes.
  // In the CLI, Vec elements are passed by repeating the flag or as a JSON array or list.
  // Wait, let's see how soroban Vec<Bytes> is formatted.
  // Normally: --ic ["hex1", "hex2", ...] or repeated --ic hex1 --ic hex2 ...
  // Let's format it as a JSON-like array for the CLI.
  const icArgs = ic.map((x) => `"${x}"`).join(",");
  const cmd = `${STELLAR_BIN} contract invoke --id ${ORACLE} --source deployer --network testnet --send=yes -- set_verification_key --alpha ${alpha} --beta ${beta} --gamma ${gamma} --delta ${delta} --ic '[${ic.map((x) => `"${x}"`).join(",")}]'`;
  console.log("Running command:", cmd);
  execSync(cmd, { stdio: "inherit" });

  console.log("Verification Key set successfully!");
}

run().catch(console.error);
