import { test, expect } from "@playwright/test";

test.describe("Crisp Solvency & Attestation Flows", () => {
  test.describe.configure({ mode: "serial" });

  test("should verify customer balance inclusion successfully", async ({
    page,
  }) => {
    await page.goto("/");

    // Locate Verification Form Inputs
    const publicKeyInput = page.locator('input[placeholder="e.g. GA111..."]');
    const balanceInput = page.locator('input[placeholder="e.g. 100000"]');
    const saltInput = page.locator('input[placeholder="e.g. a3c1"]');

    // Fill in default test user (seeded via mock db)
    await publicKeyInput.fill(
      "GA111111111111111111111111111111111111111111111111111111",
    );
    await balanceInput.fill("100000");
    await saltInput.fill("a3c1");

    // Click Verify button
    await page.click('button:has-text("Verify Inclusion")');

    // Wait for validation success logs and output
    await expect(page.locator("text=Inclusion Verified!")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Inclusion Proof Visualizer")).toBeVisible();
    await expect(page.locator("text=ROOT COMMITMENT")).toBeVisible();
    await expect(page.locator("text=SIBLING MERKLE PATH")).toBeVisible();
    await expect(page.locator("text=YOUR VERIFIED LEAF")).toBeVisible();
  });

  test("should publish a new solvency attestation successfully", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Connect Issuer Wallet
    const connectBtn = page.getByRole("button", {
      name: "Connect Freighter Wallet",
    });
    await expect(connectBtn).toBeVisible();
    // Real Freighter needs the browser extension, unavailable in CI — the Demo
    // button loads a predefined sandbox issuer identity instead.
    const demoBtn = page.getByRole("button", { name: "Use Demo Identity" });
    await demoBtn.click();

    // Verify wallet connected state
    await expect(page.locator("text=Address: GDISSUER")).toBeVisible({
      timeout: 5000,
    });

    // 2. Publish Solvency Proof
    const reservesInput = page.locator('.glow-teal input[type="number"]');
    await reservesInput.fill("700000"); // solvent reserves

    const publishBtn = page.getByRole("button", {
      name: "Publish Solvency Proof",
    });
    await publishBtn.click();

    // Check step-by-step logs streaming
    await expect(page.locator("text=Constructing Merkle-Sum Tree")).toBeVisible(
      { timeout: 5000 },
    );
    await expect(page.locator("text=Generating ZK Proof")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator("text=Submitting attestation to Soroban"),
    ).toBeVisible({ timeout: 5000 });

    // Wait for final success message
    await expect(
      page.locator("text=Solvency Attestation Successfully Published!"),
    ).toBeVisible({ timeout: 15000 });
  });

  test("should reject attestation when reserves are less than liabilities", async ({
    page,
  }) => {
    await page.goto("/");

    // Load the demo issuer identity (see note above)
    const demoBtn = page.getByRole("button", { name: "Use Demo Identity" });
    await demoBtn.click();

    // Verify wallet connected state
    await expect(page.locator("text=Address: GDISSUER")).toBeVisible({
      timeout: 5000,
    });

    // Set reserves below liabilities (liabilities total is 500,000 USDC)
    const reservesInput = page.locator('.glow-teal input[type="number"]');
    await reservesInput.fill("400000"); // insolvent

    const publishBtn = page.getByRole("button", {
      name: "Publish Solvency Proof",
    });
    await publishBtn.click();

    // Wait for rejection error log or message
    await expect(page.locator("text=invariant violated").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
