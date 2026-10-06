import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSample } from "../src/model.js";
import { exportWebsite } from "../src/export.js";
const { chromium } = await import("playwright");
const base = process.env.FOLIO_BASE_URL || "http://127.0.0.1:4173";
let server, browser, browserVersion;
const results = [],
  runtimeErrors = [];
const output = resolve("test-results");
await mkdir(output, { recursive: true });
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: "passed", durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({
      name,
      status: "failed",
      message: error.message,
      durationMs: Date.now() - start,
    });
    throw error;
  }
}
async function ready() {
  try {
    return (await fetch(base)).ok;
  } catch {
    return false;
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  if (!(await ready())) {
    server = spawn(process.execPath, ["scripts/serve.mjs", "--dist"], {
      env: process.env,
      stdio: "ignore",
    });
    for (let i = 0; i < 60 && !(await ready()); i++) await delay(100);
  }
  assert.ok(await ready(), "Static app server must respond");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FOLIO_BROWSER
      ? { executablePath: process.env.FOLIO_BROWSER }
      : {}),
  });
  browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await page.goto(base);
  await page.locator(".template-card iframe").first().waitFor();
  await check("Catalog has four templates and profession filters", async () => {
    assert.equal(await page.locator(".template-card").count(), 4);
    await page
      .getByRole("button", { name: "For designers", exact: true })
      .click();
    assert.equal(await page.locator(".template-card").count(), 3);
    await page
      .getByRole("button", { name: "For developers", exact: true })
      .click();
    assert.equal(await page.locator(".template-card").count(), 3);
    await page
      .getByRole("button", { name: "All templates", exact: true })
      .click();
  });
  await check("Template exploration opens and closes with Escape", async () => {
    await page.locator('[data-action="template-preview"]').first().click();
    assert.ok(await page.locator("dialog").isVisible());
    await page.keyboard.press("Escape");
    assert.ok(!(await page.locator("dialog").isVisible()));
  });
  await check(
    "A first-time developer gets the developer sample on a touch screen",
    async () => {
      const touch = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const test = await touch.newPage();
      await test.goto(base);
      await test
        .locator('[data-action="use-template"][data-id="studio"]')
        .tap();
      assert.equal(
        await test.locator('[data-field="profession"]').inputValue(),
        "developer",
      );
      assert.equal(
        await test.locator('[data-field="name"]').inputValue(),
        "Rowan Ellis",
      );
      await test.frameLocator("#live-preview").locator(".fp--studio").waitFor();
      assert.ok(
        await test.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await touch.close();
    },
  );
  await page.locator('[data-action="use-template"]').first().click();
  await check(
    "The brand returns to templates without discarding the draft",
    async () => {
      await page
        .getByRole("link", { name: "Folio Studio home", exact: true })
        .click();
      assert.equal(await page.locator(".template-card").count(), 4);
      await page
        .getByRole("button", { name: "My portfolio", exact: true })
        .click();
      assert.equal(await page.locator(".project-tab").count(), 3);
    },
  );
  const name = page.locator('[data-field="name"]');
  await check("Editing updates preview and persists after reload", async () => {
    await name.fill("Jordan Test");
    await page
      .locator('[data-field="tagline"]')
      .fill("Making useful things, thoughtfully.");
    await page.waitForFunction(
      () =>
        document.querySelector("#save-status")?.textContent ===
        "Saved on this device",
    );
    await page.reload();
    assert.equal(
      await page.locator('[data-field="name"]').inputValue(),
      "Jordan Test",
    );
    await page
      .frameLocator("#live-preview")
      .getByText("Jordan Test", { exact: true })
      .first()
      .waitFor();
  });
  await check(
    "An unfinished link survives reload without losing the draft",
    async () => {
      const field = page.locator('[data-project-field="url"]');
      const previous = await field.inputValue();
      await field.fill("https://");
      await page.waitForFunction(
        () =>
          document.querySelector("#save-status")?.textContent ===
          "Saved on this device",
      );
      await page.reload();
      assert.equal(
        await page.locator('[data-field="name"]').inputValue(),
        "Jordan Test",
      );
      assert.equal(
        await page.locator('[data-project-field="url"]').inputValue(),
        "https://",
      );
      assert.equal(await page.locator(".project-tab").count(), 3);
      await page.locator('[data-project-field="url"]').fill(previous);
    },
  );
  await check("Uploaded PNG is optimized and included in backup", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9D8AAAAASUVORK5CYII=",
      "base64",
    );
    await page
      .locator("#image-upload")
      .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    await page.locator(".image-upload img").waitFor();
    assert.ok(
      (await page.locator(".image-upload img").getAttribute("src")).startsWith(
        "data:image/webp;base64,",
      ),
    );
  });
  await check("Template switching preserves content and images", async () => {
    await page.getByText("Look & feel", { exact: true }).click();
    for (const template of ["gallery", "studio", "room", "editorial"]) {
      await page.locator('[data-field="template"]').selectOption(template);
      await page
        .frameLocator("#live-preview")
        .locator(`.fp--${template}`)
        .waitFor();
      assert.equal(
        await page.locator('[data-field="name"]').inputValue(),
        "Jordan Test",
      );
      assert.ok(await page.locator(".image-upload img").isVisible());
    }
  });
  await check(
    "Keyboard alternative reorders and removes projects",
    async () => {
      const first = await page
        .locator(".project-tab span")
        .first()
        .textContent();
      await page.locator('[data-action="move-down"]').click();
      assert.equal(
        await page.locator(".project-tab span").nth(1).textContent(),
        first,
      );
      await page.locator('[data-action="delete-project"]').click();
      await page.locator('[data-action="confirm-delete-project"]').click();
      assert.equal(await page.locator(".project-tab").count(), 2);
    },
  );
  await check(
    "Explicit ownership confirmation removes sample label",
    async () => {
      await page.locator('[data-action="own-work"]').click();
      await page.locator('[data-action="confirm-own-work"]').click();
      assert.equal(await page.locator(".sample-banner").count(), 0);
    },
  );
  let backupPath;
  await check(
    "Project backup downloads and restores after clearing",
    async () => {
      await page.locator('[data-action="tools"]').click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator('[data-action="download-project"]').click();
      const download = await downloadPromise;
      backupPath = resolve(output, "restore.folio.json");
      await download.saveAs(backupPath);
      const parsed = JSON.parse(await readFile(backupPath, "utf8"));
      assert.equal(parsed.name, "Jordan Test");
      assert.equal(parsed.projects.length, 2);
      await page.locator('[data-action="fresh"]').click();
      await page.locator('[data-action="confirm-fresh"]').click();
      assert.equal(await page.locator(".project-tab").count(), 0);
      await page.locator('[data-action="tools"]').click();
      await page.locator("#project-import").setInputFiles(backupPath);
      await page.locator('[data-action="confirm-import"]').click();
      assert.equal(
        await page.locator('[data-field="name"]').inputValue(),
        "Jordan Test",
      );
      assert.equal(await page.locator(".project-tab").count(), 2);
    },
  );
  await check("Malformed project import keeps the existing draft", async () => {
    await page.locator('[data-action="tools"]').click();
    await page.locator("#project-import").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
    await page
      .getByRole("status")
      .getByText(/not valid JSON/)
      .waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator('[data-field="name"]').inputValue(),
      "Jordan Test",
    );
  });
  let exportedPath;
  await check(
    "Export requires public-content confirmation and produces standalone HTML",
    async () => {
      await page.locator('[data-action="export"]').click();
      assert.ok(
        await page.locator('[data-action="confirm-export"]').isDisabled(),
      );
      await page.locator("#public-confirm").check();
      const downloadPromise = page.waitForEvent("download");
      await page.locator('[data-action="confirm-export"]').click();
      const download = await downloadPromise;
      exportedPath = resolve(output, "exported-index.html");
      await download.saveAs(exportedPath);
      const html = await readFile(exportedPath, "utf8");
      assert.ok(html.includes("Apache License"));
      assert.ok(html.includes("Jordan Test"));
      assert.ok(!/<script\b/i.test(html));
      await page.keyboard.press("Escape");
      const exported = await context.newPage();
      await exported.goto(pathToFileURL(exportedPath).href);
      assert.equal(await exported.locator(".fp").count(), 1);
      assert.equal(await exported.locator(".fp-sample").count(), 0);
      await exported.close();
    },
  );
  await check(
    "GitHub import uses returned data and does not invent a demo",
    async () => {
      await page.route("https://api.github.com/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const json = path.endsWith("/repos")
          ? [
              {
                id: 10,
                name: "real-fixture",
                description: "API integration fixture",
                html_url: "https://github.com/test-user/real-fixture",
                homepage: "",
                language: "JavaScript",
                topics: [],
                fork: false,
                archived: false,
              },
            ]
          : { login: "test-user", name: "API Test User", id: 1 };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(json),
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      });
      await page.locator('[data-action="github"]').click();
      await page.locator("#github-username").fill("test-user");
      await page
        .getByRole("button", { name: "Find projects", exact: true })
        .click();
      await page.locator(".repo-option").waitFor();
      await page.locator('input[name="repository"]').check();
      await page.locator('[data-action="add-github"]').click();
      assert.equal(
        await page.locator('[data-project-field="source"]').inputValue(),
        "https://github.com/test-user/real-fixture",
      );
      assert.equal(
        await page.locator('[data-project-field="url"]').inputValue(),
        "",
      );
      await page.unroute("https://api.github.com/**");
    },
  );
  await check(
    "GitHub missing account and rate limit have honest errors",
    async () => {
      for (const status of [404, 429]) {
        await page.route("https://api.github.com/**", (route) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify({
              message: status === 404 ? "Not Found" : "API rate limit exceeded",
            }),
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Retry-After": "60",
              "X-RateLimit-Remaining": "0",
            },
          }),
        );
        await page.locator('[data-action="github"]').click();
        await page.locator("#github-username").fill("test-user");
        await page
          .getByRole("button", { name: "Find projects", exact: true })
          .click();
        await page.locator(".inline-error").waitFor();
        assert.ok(
          (await page.locator(".inline-error").textContent()).length > 10,
        );
        await page.keyboard.press("Escape");
        await page.unroute("https://api.github.com/**");
      }
    },
  );
  await check(
    "Escaped content renders as text with no script execution",
    async () => {
      await page
        .locator('[data-field="name"]')
        .fill('<img src=x onerror="alert(1)">');
      await page
        .frameLocator("#live-preview")
        .getByText('<img src=x onerror="alert(1)">', { exact: true })
        .first()
        .waitFor();
      assert.equal(
        await page
          .frameLocator("#live-preview")
          .locator('img[src="x"]')
          .count(),
        0,
      );
      await page.locator('[data-field="name"]').fill("Jordan Test");
    },
  );
  await check("Catalog and editor fit mobile viewport", async () => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page
      .frameLocator('[data-template-preview="editorial"]')
      .locator(".fp")
      .waitFor();
    await page.screenshot({
      path: resolve(output, "catalog-mobile.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "My portfolio", exact: true })
      .click();
    await page.frameLocator("#live-preview").locator(".fp").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: resolve(output, "editor-mobile.png"),
      fullPage: true,
    });
  });
  await check(
    "Unavailable storage warns honestly and allows a project backup",
    async () => {
      const isolated = await browser.newContext({ acceptDownloads: true });
      await isolated.addInitScript(() => {
        Storage.prototype.setItem = function () {
          throw new DOMException("Storage unavailable", "QuotaExceededError");
        };
      });
      const test = await isolated.newPage();
      await test.goto(`${base}/#editor`);
      await test.locator('[data-field="name"]').fill("Recoverable draft");
      await test
        .getByText("Not saved · Download a backup", { exact: true })
        .waitFor();
      await test.locator('[data-action="tools"]').click();
      const pending = test.waitForEvent("download");
      await test.locator('[data-action="download-project"]').click();
      const file = resolve(output, "storage-recovery.folio.json");
      await (await pending).saveAs(file);
      assert.equal(
        JSON.parse(await readFile(file, "utf8")).name,
        "Recoverable draft",
      );
      await isolated.close();
    },
  );
  await check(
    "All exported templates fit mobile and desktop with working case details",
    async () => {
      const css = await readFile("src/templates.css", "utf8");
      const exported = await context.newPage();
      for (const template of ["editorial", "gallery", "studio", "room"])
        for (const width of [375, 680, 1280]) {
          const sample = createSample(
            template === "studio" ? "developer" : "designer",
          );
          sample.template = template;
          await exported.setViewportSize({ width, height: 900 });
          await exported.setContent(exportWebsite(sample, css));
          assert.ok(
            await exported.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${template} at ${width}px`,
          );
          await exported.locator(".fp-case summary").first().click();
          assert.ok(
            await exported.locator(".fp-case-content").first().isVisible(),
          );
        }
      await exported.close();
    },
  );
  await check("Reduced motion preference disables animations", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    const duration = await page
      .locator(".button")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    assert.ok(duration.split(",").every((d) => parseFloat(d) === 0));
  });
  await check(
    "Motion replay works in every sandboxed preview without changing creator content",
    async () => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      for (const id of ["editorial", "gallery", "studio", "room"]) {
        await page
          .locator(`[data-action="template-preview"][data-id="${id}"]`)
          .click();
        const frame = page.frameLocator("#explore-preview");
        await frame.locator(`.fp--${id}`).waitFor();
        assert.equal(
          await page.locator("#explore-preview").getAttribute("sandbox"),
          "",
        );
        await page
          .getByRole("button", { name: "Replay motion", exact: true })
          .click();
        await frame.locator(`.fp--${id}`).waitFor();
        assert.notEqual(
          await frame
            .locator(".fp-title-word")
            .first()
            .evaluate((el) => getComputedStyle(el).animationName),
          "none",
        );
        await page.keyboard.press("Escape");
      }
      await page
        .getByRole("button", { name: "My portfolio", exact: true })
        .click();
      const name = await page.locator('[data-field="name"]').inputValue();
      await page.locator(".editor-section").last().locator("summary").click();
      await page.locator('[data-field="motion"]').uncheck();
      await page.frameLocator("#live-preview").locator(".fp--still").waitFor();
      await page
        .getByRole("button", { name: "Replay motion", exact: true })
        .click();
      await page.frameLocator("#live-preview").locator(".fp--still").waitFor();
      assert.equal(
        await page.locator('[data-field="name"]').inputValue(),
        name,
      );
      assert.equal(
        await page.locator("#live-preview").getAttribute("sandbox"),
        "allow-popups allow-popups-to-escape-sandbox",
      );
      await page.locator('[data-field="motion"]').check();
    },
  );
  await check("No uncaught browser runtime errors", async () =>
    assert.deepEqual(runtimeErrors, []),
  );
  await page.screenshot({
    path: resolve(output, "catalog-desktop.png"),
    fullPage: true,
  });
  console.log(`Passed ${results.length} browser scenarios.`);
} finally {
  await writeFile(
    resolve(output, "browser-report.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        browserVersion,
        results,
        runtimeErrors,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  server?.kill();
}
