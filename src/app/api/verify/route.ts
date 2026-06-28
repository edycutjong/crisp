import { NextResponse } from "next/server";
import { getProofForAccount } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 },
      );
    }

    const proofData = await getProofForAccount(accountId);

    if (!proofData) {
      return NextResponse.json(
        { error: "No inclusion proof found for this account ID." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      account_address: proofData.account_address,
      balance: proofData.balance,
      proof_path: proofData.proof_path,
      kyc_root: proofData.kyc_root,
      solvency_report: proofData.solvency_reports,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch user inclusion proof",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
