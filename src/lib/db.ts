/* istanbul ignore next */
import { createClient } from "@supabase/supabase-js";
import { MerkleSumTree } from "./merkleSumTree";

export function getIsMock() {
  if (process.env.CRISP_MOCK_MODE === "true") return true;
  if (process.env.CRISP_MOCK_MODE === "false") return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) return true;
  if (!anon) return true;
  if (url.includes("xxxx")) return true;
  if (anon.includes("xxxx")) return true;
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: any = null;

export function getSupabase() {
  if (getIsMock()) {
    return null;
  }
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export interface SolvencyReport {
  id?: string;
  issuer_address: string;
  tx_hash: string;
  total_liabilities: number;
  total_reserves: number;
  kyc_root: string;
  timestamp: string;
}

export interface UserBalanceProofNode {
  hash: string;
  sum: string;
  isRight: boolean;
}

export interface UserBalanceProof {
  id?: string;
  kyc_root: string;
  account_address: string;
  balance: number;
  proof_path: UserBalanceProofNode[];
}

import fs from "fs";
import path from "path";

function getMockDb() {
  const p = path.join(process.cwd(), "public", "mock_db.json");
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return { reports: [], proofs: [] };
}

function saveMockDb(reports: SolvencyReport[], proofs: UserBalanceProof[]) {
  const p = path.join(process.cwd(), "public", "mock_db.json");
  fs.writeFileSync(p, JSON.stringify({ reports, proofs }, null, 2));
}

/* istanbul ignore next */
export async function seedInMemory() {
  try {
    const defaultUsers = [
      {
        accountId: "GA111111111111111111111111111111111111111111111111111111",
        balance: 100000n,
        salt: "a3c1",
      },
      {
        accountId: "GA222222222222222222222222222222222222222222222222222222",
        balance: 150000n,
        salt: "b8e2",
      },
      {
        accountId: "GA333333333333333333333333333333333333333333333333333333",
        balance: 50000n,
        salt: "c9d3",
      },
      {
        accountId: "GA444444444444444444444444444444444444444444444444444444",
        balance: 200000n,
        salt: "d1f4",
      },
    ];

    const tree = new MerkleSumTree(defaultUsers, true);
    await tree.build();
    const root = tree.getRoot();

    const report = {
      id: "demo-report-id",
      issuer_address: "GDISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      tx_hash:
        "8888888888888888888888888888888888888888888888888888888888888888",
      total_liabilities: Number(root.sum),
      total_reserves: 520000,
      kyc_root: root.hash,
      timestamp: new Date().toISOString(),
    };

    const proofs = defaultUsers.map((user) => {
      const proof = tree.getProof(user.accountId);
      const serializedPath = proof.path.map((node) => ({
        hash: node.hash,
        sum: node.sum.toString(),
        isRight: node.isRight,
      }));
      return {
        kyc_root: root.hash,
        account_address: user.accountId,
        balance: Number(user.balance),
        proof_path: serializedPath,
      };
    });

    saveMockDb([report], proofs);
  } catch (err) {
    console.error("Error seeding mock db:", err);
  }
}

if (getIsMock()) {
  if (typeof window === "undefined") {
    // Only seed on the server side
    seedInMemory();
  }
}

/* istanbul ignore next */
export async function getLatestReport() {
  if (getIsMock()) {
    const db = getMockDb();
    const rep = db.reports[0];
    if (rep !== undefined) {
      return rep;
    }
    return null;
  }
  const client = getSupabase();
  const { data, error } = await client!
    .from("crisp_solvency_reports")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(1);
  if (error) {
    throw error;
  }
  if (data && data.length > 0) {
    return data[0];
  }
  return null;
}

/* istanbul ignore next */
export async function getProofForAccount(accountId: string) {
  if (getIsMock()) {
    const db = getMockDb();
    const proof = (db.proofs as UserBalanceProof[]).find(
      (p) => p.account_address === accountId,
    );
    if (!proof) {
      return null;
    }
    const rep = (db.reports as SolvencyReport[]).find(
      (r) => r.kyc_root === proof.kyc_root,
    );
    return {
      account_address: proof.account_address,
      balance: proof.balance,
      proof_path: proof.proof_path,
      kyc_root: proof.kyc_root,
      solvency_reports: rep !== undefined ? rep : null,
    };
  }
  const client = getSupabase();
  const { data, error } = await client!
    .from("crisp_user_balance_proofs")
    .select(
      `
      account_address,
      balance,
      proof_path,
      kyc_root,
      solvency_reports:kyc_root (
        total_liabilities,
        total_reserves,
        timestamp,
        tx_hash
      )
    `,
    )
    .eq("account_address", accountId)
    .limit(1);
  if (error) {
    throw error;
  }
  if (data && data.length > 0) {
    return data[0];
  }
  return null;
}

/* istanbul ignore next */
export async function insertNewAttestation(
  report: SolvencyReport,
  proofs: UserBalanceProof[],
) {
  if (getIsMock()) {
    saveMockDb([report], proofs);
    return;
  }

  const client = getSupabase();

  // Clear old data and write to Supabase
  await client!
    .from("crisp_user_balance_proofs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await client!
    .from("crisp_solvency_reports")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  const { error: reportError } = await client!
    .from("crisp_solvency_reports")
    .insert([report]);
  if (reportError) {
    throw reportError;
  }

  const { error: proofsError } = await client!
    .from("crisp_user_balance_proofs")
    .insert(proofs);
  if (proofsError) {
    throw proofsError;
  }
}
