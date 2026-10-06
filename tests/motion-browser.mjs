import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createSample, TEMPLATES } from "../src/model.js";
import { exportWebsite } from "../src/export.js";

const css = await readFile("src/templates.css", "utf8");
const output = "test-results/motion";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FOLIO_BROWSER
    ? { executablePath: process.env.FOLIO_BROWSER }
    : {}),
});
const results = [];
const context = await browser.newContext({ reducedMotion: "no-preference" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const requests = [];
await context.route("**/*", (route) => {
  requests.push(route.request().url());
  return route.abort();
});
async function check(name, run) {
  try {
    await run();
    results.push({ name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "failed", message: error.message });
    throw error;
  }
}
async function settledTitle() {
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".fp-title-word")].every(
      (el) => getComputedStyle(el).transform === "none",
    ),
  );
}
async function load(input) {
  await page.setContent(exportWebsite(input, css));
  await page.evaluate(() => scrollTo(0, 0));
}
try {
  for (const { id } of TEMPLATES) {
    const doc = {
      ...createSample(id === "studio" ? "developer" : "designer"),
      template: id,
    };
    await check(
      `${id}: offline export animates, has one accessible heading and settles`,
      async () => {
        await page.emulateMedia({
          reducedMotion: "no-preference",
          media: "screen",
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        await load(doc);
        assert.equal(
          await page
            .getByRole("heading", { level: 1, name: doc.tagline, exact: true })
            .count(),
          1,
        );
        assert.notEqual(
          await page
            .locator(".fp-title-word")
            .first()
            .evaluate((el) => getComputedStyle(el).animationName),
          "none",
        );
        await settledTitle();
        assert.ok(await page.locator(".fp-title-word").last().isVisible());
        await page.screenshot({ path: `${output}/${id}-desktop.png` });
      },
    );
    await check(
      `${id}: scroll arrival and keyboard project access`,
      async () => {
        const article = page.locator("article").last();
        await article.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForFunction(
          () =>
            Number(
              getComputedStyle(document.querySelector("article:last-of-type"))
                .opacity,
            ) > 0.95,
        );
        const summary = article.locator("summary");
        await summary.focus();
        await page.keyboard.press("Enter");
        assert.ok(await article.locator("details").evaluate((el) => el.open));
        assert.ok(await article.locator(".fp-case-content").isVisible());
        if (id === "room") {
          const object = page.locator(".fp-room-object").last();
          await object.focus();
          assert.equal(
            await object.evaluate((el) => getComputedStyle(el).opacity),
            "1",
          );
          await page.keyboard.press("Enter");
          await page.waitForFunction(() => location.hash === "#fp-project-3");
          assert.equal(
            await article.evaluate((el) => getComputedStyle(el).animationName),
            "none",
          );
        }
      },
    );
    await check(
      `${id}: system reduced motion and creator switch disable every animation`,
      async () => {
        for (const system of [true, false]) {
          await page.emulateMedia({
            reducedMotion: system ? "reduce" : "no-preference",
          });
          await page.setContent(exportWebsite({ ...doc, motion: system }, css));
          const moving = await page.locator(".fp").evaluate((root) =>
            [...root.querySelectorAll("*")]
              .filter((el) => {
                const style = getComputedStyle(el);
                return (
                  style.animationName !== "none" ||
                  style.transitionDuration
                    .split(",")
                    .some((value) => parseFloat(value) > 0)
                );
              })
              .map((el) => el.className),
          );
          assert.deepEqual(moving, []);
          assert.equal(
            await page
              .locator(".fp-title-word")
              .first()
              .evaluate((el) => getComputedStyle(el).transform),
            "none",
          );
        }
      },
    );
    await check(
      `${id}: print and unsupported scroll timelines keep content visible`,
      async () => {
        await page.emulateMedia({
          reducedMotion: "no-preference",
          media: "screen",
        });
        await page.setContent(exportWebsite(doc, css));
        // Remove the progressive layer to exercise the fallback in this browser.
        await page.evaluate(() => {
          const strip = (sheet) => {
            for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
              const rule = sheet.cssRules[i];
              if (
                rule instanceof CSSSupportsRule &&
                rule.conditionText.includes("animation-timeline")
              )
                sheet.deleteRule(i);
              else if (rule.cssRules) strip(rule);
            }
          };
          strip(document.styleSheets[0]);
        });
        await settledTitle();
        await page.waitForFunction(() =>
          [...document.querySelectorAll("article")].every(
            (el) => getComputedStyle(el).opacity === "1",
          ),
        );
        await page.emulateMedia({ media: "print" });
        const hidden = await page
          .locator("article")
          .evaluateAll(
            (els) =>
              els.filter(
                (el) =>
                  getComputedStyle(el).opacity !== "1" ||
                  getComputedStyle(el).animationName !== "none",
              ).length,
          );
        assert.equal(hidden, 0);
      },
    );
    await check(
      `${id}: narrow layout and long headings do not overflow`,
      async () => {
        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width: 375, height: 812 });
        await page.setContent(
          exportWebsite({ ...doc, tagline: "A".repeat(240) }, css),
        );
        await settledTitle();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const content = page.locator("article").first();
        await content.locator("summary").click();
        assert.ok(await content.locator(".fp-case-content").isVisible());
      },
    );
  }
  await check(
    "All four templates work on a touch device with page JavaScript disabled",
    async () => {
      const touch = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        javaScriptEnabled: false,
        reducedMotion: "no-preference",
      });
      const mobile = await touch.newPage();
      for (const { id } of TEMPLATES) {
        await mobile.setContent(
          exportWebsite({ ...createSample(), template: id }, css),
        );
        await mobile.locator(".fp-case summary").first().tap();
        assert.ok(
          await mobile
            .locator(".fp-case")
            .first()
            .evaluate((el) => el.open),
        );
        assert.ok(
          await mobile.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await mobile.screenshot({ path: `${output}/${id}-mobile.png` });
      }
      await touch.close();
    },
  );
  await check("Gallery art responds to hover and returns to rest", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setContent(
      exportWebsite({ ...createSample(), template: "gallery" }, css),
    );
    const art = page.locator(".fp-art-shape--one").first();
    await page.locator(".fp-art").first().hover();
    await page.waitForFunction(
      () =>
        parseFloat(
          getComputedStyle(document.querySelector(".fp-art-shape--one")).scale,
        ) > 1.05,
    );
    await page.locator(".fp-wordmark").hover();
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".fp-art-shape--one")).scale ===
        "1",
    );
    assert.ok(await art.isVisible());
  });
  await check(
    "Exports make no network requests and raise no runtime errors",
    async () => {
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
    },
  );
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { browser: browser.version(), date: new Date().toISOString(), results },
      null,
      2,
    ),
  );
  await browser.close();
}
