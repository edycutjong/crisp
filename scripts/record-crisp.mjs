import { chromium } from "playwright";

async function record() {
  console.log("Starting demo screen recording script (mock)...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Visit local running server
    await page.goto("http://localhost:3000");
    await page.waitForTimeout(2000);

    console.log("Step 1: Navigated to homepage, verifying solvency status...");
    await page.click('a[href="#demo"]');
    await page.waitForTimeout(1000);

    console.log("Step 2: Connecting simulated Freighter Wallet...");
    // Connect wallet
    await page.click("text=Connect Freighter Wallet");
    await page.waitForTimeout(2000);

    console.log("Step 3: Triggering solvency attestation...");
    // Run attestation
    await page.click("text=Publish Solvency Proof");
    await page.waitForTimeout(6000); // wait for ZK proof logs

    console.log("Step 4: Running user inclusion check...");
    // Verify user balance
    await page.click("text=Verify Inclusion");
    await page.waitForTimeout(3000);

    console.log("Automation run completed successfully.");
  } catch (err) {
    console.error("Error during screen record run:", err);
  } finally {
    await browser.close();
  }
}

record();
