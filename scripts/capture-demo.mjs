// Capture the running app in a clean, temporary browser profile.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createSample } from "../src/model.js";
import { exportWebsite } from "../src/export.js";

const base = process.env.FOLIO_BASE_URL || "http://127.0.0.1:4173";
const screenshots = resolve("docs/screenshots");
const demos = resolve("docs/demos");
await mkdir(screenshots, { recursive: true });
await mkdir(demos, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FOLIO_BROWSER
    ? { executablePath: process.env.FOLIO_BROWSER }
    : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  await page.goto(base);
  for (const template of ["editorial", "gallery", "studio", "room"]) {
    await page
      .frameLocator(`[data-template-preview="${template}"]`)
      .locator(".fp")
      .waitFor();
  }
  await page.screenshot({
    path: resolve(screenshots, "template-library.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "My portfolio", exact: true }).click();
  await page.frameLocator("#live-preview").locator(".fp").waitFor();
  await page.screenshot({ path: resolve(screenshots, "studio-desktop.png") });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${base}/#editor`);
  await mobile.frameLocator("#live-preview").locator(".fp").waitFor();
  await mobile.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await mobile.screenshot({ path: resolve(screenshots, "studio-mobile.png") });
  await mobileContext.close();

  const styles = await readFile("src/templates.css", "utf8");
  const exported = await context.newPage();
  await exported.setViewportSize({ width: 1280, height: 1000 });
  for (const template of ["editorial", "gallery", "studio", "room"]) {
    const sample = createSample(
      template === "studio" ? "developer" : "designer",
    );
    sample.template = template;
    const html = exportWebsite(sample, styles);
    await writeFile(resolve(demos, `${template}.html`), html);
    await exported.setContent(html);
    await exported.screenshot({
      path: resolve(screenshots, `${template}.png`),
    });
  }
  console.log(
    "Captured seven application screenshots and four labeled sample exports.",
  );
} finally {
  await browser.close();
}
