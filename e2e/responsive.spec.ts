import { test, expect } from "@playwright/test";

test.describe("Crisp Layout Responsiveness Tests", () => {
  const viewports = [
    { width: 375, height: 667, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1440, height: 900, name: "desktop" },
  ];

  for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name} viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/");

      // Ensure main elements are visible
      await expect(page.locator("h1")).toBeVisible();

      // Check that there is no horizontal scroll on the document body
      const overflowX = await page.evaluate(() => {
        return window.innerWidth < document.documentElement.scrollWidth;
      });
      expect(overflowX).toBe(false);
    });
  }
});
