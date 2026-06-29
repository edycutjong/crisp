import { NextResponse } from "next/server";
import { getLatestReport } from "@/lib/db";

const oracleAddress =
  process.env.NEXT_PUBLIC_SOLVENCY_ORACLE ||
  "CDXROOACFGK7FIOMNRO22O25O5YIMSHA3DKEIQXUUWHR74QGVGKXXSOY";

export async function GET() {
  try {
    const latest = await getLatestReport();
    const timestamp = latest
      ? Math.floor(new Date(latest.timestamp).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    return NextResponse.json({
      status: "active",
      network: "testnet",
      contracts: {
        solvency_oracle: oracleAddress,
      },
      verify_entrypoint: "attest_reserves",
      latest_proof: {
        verified: latest ? true : false,
        timestamp: timestamp,
        kyc_root: latest ? latest.kyc_root : null,
        total_liabilities: latest ? latest.total_liabilities : 0,
        total_reserves: latest ? latest.total_reserves : 0,
      },
      note: "Real BN254 Groth16 solvency verification is reproduced via `npm run prove:demo` (attest_reserves on-chain).",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch oracle telemetry",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
