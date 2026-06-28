const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");
const { MerkleSumTree } = require("../src/lib/merkleSumTree");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Error: Supabase environment variables are missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

async function fetchHorizonBalances() {
  try {
    const res = await fetch(
      "https://horizon-testnet.stellar.org/accounts?asset=USDC:GA2FZDW4SABBXZ7XNG6KBNSH62NMXEW464RDAZEW6GQDBBENAX2LC43A&limit=10",
    );
    if (res.ok) {
      const data = await res.json();
      const records = data._embedded?.records || [];
      if (records.length >= 2) {
        const scraped = records.map((rec, idx) => {
          const balanceObj = rec.balances.find((b) => b.asset_code === "USDC");
          const balanceVal = balanceObj ? parseFloat(balanceObj.balance) : 0;
          const balanceBig = BigInt(Math.floor(balanceVal));
          return {
            accountId: rec.account_id,
            balance: balanceBig > 0n ? balanceBig : BigInt((idx + 1) * 25000),
            salt: `salt_${rec.account_id.substring(2, 6)}_${idx}`,
          };
        });
        return [...defaultUsers, ...scraped];
      }
    }
  } catch (err) {
    console.warn(
      "Horizon balance scrape in seeder failed, using defaults:",
      err.message,
    );
  }
  return defaultUsers;
}

async function seed() {
  const users = await fetchHorizonBalances();
  console.log(
    `Scraped ${users.length} active USDC accounts from Horizon Testnet.`,
  );
  console.log(`Building Merkle-Sum Tree for ${users.length} users...`);

  // Build the tree
  const tree = new MerkleSumTree(users, true);
  await tree.build();

  const root = tree.getRoot();
  const totalLiabilities = root.sum;
  const reservesThreshold = 520000n; // $520,000 reserves (solvent)

  console.log("Merkle-Sum Root Hash:", root.hash);
  console.log("Total Liabilities:", totalLiabilities.toString());

  // Issuer details
  const issuerAddress =
    "GDISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const txHash =
    "8888888888888888888888888888888888888888888888888888888888888888";

  console.log("Inserting Solvency Report into Supabase...");

  // 1. Delete old rows to prevent key conflicts
  await supabase
    .from("crisp_user_balance_proofs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase
    .from("crisp_solvency_reports")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  // 2. Insert report
  const { data: reportData, error: reportError } = await supabase
    .from("crisp_solvency_reports")
    .insert([
      {
        issuer_address: issuerAddress,
        tx_hash: txHash,
        total_liabilities: Number(totalLiabilities),
        total_reserves: Number(reservesThreshold),
        kyc_root: root.hash,
        timestamp: new Date().toISOString(),
      },
    ])
    .select();

  if (reportError) {
    console.error("Error inserting report:", reportError);
    process.exit(1);
  }

  console.log("Solvency Report inserted successfully:", reportData);

  // 3. Generate and insert inclusion proofs for each user
  console.log("Generating inclusion proofs for each user...");
  const proofsToInsert = [];

  for (const user of users) {
    const proof = tree.getProof(user.accountId);

    // Convert bigint values to numbers/strings for JSON serialization
    const serializedPath = proof.path.map((node) => ({
      hash: node.hash,
      sum: node.sum.toString(),
      isRight: node.isRight,
    }));

    proofsToInsert.push({
      kyc_root: root.hash,
      account_address: user.accountId,
      balance: Number(user.balance),
      proof_path: serializedPath,
    });
  }

  const { data: proofsData, error: proofsError } = await supabase
    .from("crisp_user_balance_proofs")
    .insert(proofsToInsert)
    .select();

  if (proofsError) {
    console.error("Error inserting inclusion proofs:", proofsError);
    process.exit(1);
  }

  console.log(`Successfully seeded ${proofsData.length} inclusion proofs!`);
  console.log("Database seeding completed successfully.");
}

seed().catch((err) => {
  console.error("Unexpected seeding error:", err);
  process.exit(1);
});
