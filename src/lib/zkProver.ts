// Real BLS12-381 Groth16 proving for Crisp's proof-of-solvency circuit.
// Mirrors the pipeline proven against the deployed oracle (`npm run prove:demo`).

// ---- soroban bls12-381 byte serialization ----
function beBytes(dec: string, len: number): Uint8Array {
  const h = BigInt(dec)
    .toString(16)
    .padStart(len * 2, "0");
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++)
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function g1Bytes(p: string[]): Uint8Array {
  const o = new Uint8Array(96);
  o.set(beBytes(p[0], 48), 0);
  o.set(beBytes(p[1], 48), 48);
  return o;
}
function g2Bytes(p: string[][]): Uint8Array {
  const o = new Uint8Array(192);
  o.set(beBytes(p[0][1], 48), 0);
  o.set(beBytes(p[0][0], 48), 48);
  o.set(beBytes(p[1][1], 48), 96);
  o.set(beBytes(p[1][0], 48), 144);
  return o;
}
export function serializeProof(proof: {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}): Uint8Array {
  const out = new Uint8Array(384);
  out.set(g1Bytes(proof.pi_a), 0);
  out.set(g2Bytes(proof.pi_b), 96);
  out.set(g1Bytes(proof.pi_c), 288);
  return out;
}
/** Hex string of a decimal field element, as 32-byte big-endian. */
export function rootHex(dec: string): string {
  return BigInt(dec).toString(16).padStart(64, "0");
}

export interface LedgerAccount {
  accountId: number | string;
  balance: number | string;
  salt: number | string;
}

export function getSnarkjs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
  return (global as any).snarkjs || require("snarkjs");
}

export class CrispProver {
  constructor(
    private zkeyUrl = "/zk/solvency.zkey",
    private wasmUrl = "/zk/solvency.wasm",
    private genWasmUrl = "/zk/gen_solvency.wasm",
  ) {}

  /**
   * Prove solvency for a 16-account ledger (the circuit is fixed at depth 4).
   * Returns the 384-byte proof, the merkle-sum root (32-byte hex, = kyc_root for
   * the contract), and the totals. `reserves` must be >= total liabilities.
   */
  public async proveSolvency(
    ledger: LedgerAccount[],
    reserves: number | string,
  ): Promise<{
    proof: Uint8Array;
    kycRootHex: string;
    totalLiabilities: string;
    reserves: string;
  }> {
    const snarkjs = getSnarkjs();
    const N = 16;
    const accountIds: string[] = [];
    const balances: string[] = [];
    const salts: string[] = [];
    let sum = 0n;
    for (let i = 0; i < N; i++) {
      const a = ledger[i] ?? { accountId: i + 1, balance: 0, salt: i + 1 };
      accountIds.push(String(a.accountId));
      balances.push(String(Math.trunc(Number(a.balance))));
      salts.push(String(a.salt));
      sum += BigInt(Math.trunc(Number(a.balance)));
    }

    // derive merkle-sum root via helper circuit
    await snarkjs.wtns.calculate(
      { accountIds, balances, salts },
      this.genWasmUrl,
      "g.wtns",
    );
    const w = await snarkjs.wtns.exportJson("g.wtns");
    const root = w[1].toString();

    const reservesStr = String(Math.trunc(Number(reserves)));
    const input = {
      expectedLiabilitiesRoot: root,
      expectedLiabilitiesSum: sum.toString(),
      reserves: reservesStr,
      accountIds,
      balances,
      salts,
    };
    const { proof } = await snarkjs.groth16.fullProve(
      input,
      this.wasmUrl,
      this.zkeyUrl,
    );

    return {
      proof: serializeProof(proof as never),
      kycRootHex: rootHex(root),
      totalLiabilities: sum.toString(),
      reserves: reservesStr,
    };
  }
}
