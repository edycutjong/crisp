import { test, expect } from "@playwright/test";

test.describe("Crisp Demo Mode Smoke Test", () => {
  test("should load the landing page successfully", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/");

    // Verify Title
    await expect(page).toHaveTitle(/Crisp — Real-Time ZK Solvency Oracle/);

    // Verify main Heading
    const heading = page.locator("h1");
    await expect(heading).toContainText("Solvency. Proven in Real-Time.");

    // Verify specific sections exist
    const publicVerificationHeader = page.getByRole("heading", {
      name: "Public Verification Panel",
    });
    await expect(publicVerificationHeader).toBeVisible();

    const issuerDashboardHeader = page.getByRole("heading", {
      name: "Issuer Attestation Panel",
    });
    await expect(issuerDashboardHeader).toBeVisible();
  });
});
