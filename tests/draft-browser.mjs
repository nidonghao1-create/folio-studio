// Independent persistence regression checks against the source application.
// Run with node tests/draft-browser.mjs; FOLIO_BROWSER can select installed Chrome.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const port = Number(process.env.FOLIO_DRAFT_PORT || 4185);
const base = `http://127.0.0.1:${port}`;
const storageKey = "folio-studio.document.v1";
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});
let browser;
let completed = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
async function ready() {
  try {
    return (await fetch(base)).ok;
  } catch {
    return false;
  }
}
async function downloadedText(download) {
  const stream = await download.createReadStream();
  const parts = [];
  for await (const part of stream) parts.push(part);
  return Buffer.concat(parts).toString("utf8");
}
async function backup(page) {
  if (!(await page.locator("#dialog").evaluate((dialog) => dialog.open)))
    await page.locator('[data-action="tools"]').click();
  const event = page.waitForEvent("download");
  await page.locator('#dialog [data-action="download-project"]').click();
  return downloadedText(await event);
}
try {
  for (let i = 0; i < 80 && !(await ready()); i++) await delay(100);
  assert.ok(await ready(), "Source application server should respond");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.FOLIO_BROWSER
      ? { executablePath: process.env.FOLIO_BROWSER }
      : {}),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.goto(`${base}/#editor`);
  await page.locator('[data-field="email"]').fill("maker@");
  await page.locator('[data-project-field="url"]').fill("https://");
  await page
    .locator('[data-project-field="source"]')
    .fill("javascript:alert(1)");
  await page.waitForFunction((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    return value?.email === "maker@" && value.projects[0]?.url === "https://";
  }, storageKey);
  await page.reload();
  assert.equal(
    await page.locator('[data-field="email"]').inputValue(),
    "maker@",
  );
  assert.equal(
    await page.locator('[data-project-field="url"]').inputValue(),
    "https://",
  );
  assert.equal(
    await page.locator('[data-project-field="source"]').inputValue(),
    "javascript:alert(1)",
  );
  results.push("Unfinished email and URLs persist after reload");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator("#image-upload")
    .setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(
    (key) =>
      JSON.parse(localStorage.getItem(key))?.projects[0]?.image?.startsWith(
        "data:image/",
      ),
    storageKey,
  );
  results.push("Image upload succeeds with unfinished links and email");

  const text = await backup(page);
  const data = JSON.parse(text);
  assert.equal(data.email, "maker@");
  assert.equal(data.projects[0].url, "https://");
  assert.equal(data.projects[0].source, "javascript:alert(1)");
  assert.ok(data.projects[0].image.startsWith("data:image/"));
  results.push(
    "Portable backup preserves every unfinished field and the image",
  );

  await page.locator('#dialog [data-action="fresh"]').click();
  await page.locator('#dialog [data-action="confirm-fresh"]').click();
  assert.equal(await page.locator('[data-field="email"]').inputValue(), "");
  await page.locator('[data-action="tools"]').click();
  await page.locator("#project-import").setInputFiles({
    name: "unfinished.folio.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await page.locator('#dialog [data-action="confirm-import"]').click();
  assert.equal(
    await page.locator('[data-field="email"]').inputValue(),
    "maker@",
  );
  assert.equal(
    await page.locator('[data-project-field="url"]').inputValue(),
    "https://",
  );
  assert.equal(
    await page.locator('[data-project-field="source"]').inputValue(),
    "javascript:alert(1)",
  );
  results.push("Downloaded unfinished backup imports into a blank editor");

  await page.locator('[data-action="export"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("valid email"),
  );
  const preview = page.frameLocator("#live-preview");
  await preview.locator("main").waitFor();
  assert.equal(
    await preview
      .locator('a[href^="javascript:"],a[href^="mailto:"],a[href="https://"]')
      .count(),
    0,
  );
  results.push(
    "Unsafe/incomplete fields remain inert and prevent website export",
  );

  const savedBeforeFailure = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  );
  await page.evaluate(() => {
    window.originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "folio-studio.document.v1")
        throw new DOMException("Full", "QuotaExceededError");
      return window.originalStorageSetItem.call(this, key, value);
    };
  });
  await page
    .locator('[data-field="name"]')
    .fill("Work preserved after quota failure");
  await page.waitForFunction(() =>
    document.querySelector("#save-status").textContent.includes("Not saved"),
  );
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    savedBeforeFailure,
  );
  const rescue = JSON.parse(await backup(page));
  assert.equal(rescue.name, "Work preserved after quota failure");
  assert.equal(rescue.email, "maker@");
  results.push(
    "Quota failure keeps prior saved data and permits an emergency backup",
  );

  await page.locator('#dialog [data-action="close-dialog"]').click();
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalStorageSetItem;
  });
  await page.locator('[data-field="name"]').fill("Recovered local draft");
  await page.waitForFunction((key) => {
    const saved = JSON.parse(localStorage.getItem(key));
    return (
      saved?.name === "Recovered local draft" &&
      document.querySelector("#save-status").textContent ===
        "Saved on this device"
    );
  }, storageKey);
  assert.deepEqual(runtimeErrors, []);
  results.push("Successful retry restores saved status without runtime errors");
  const originalBrokenDraft = '{"version":1,"projects":';
  await page.evaluate(({ key, text }) => localStorage.setItem(key, text), {
    key: storageKey,
    text: originalBrokenDraft,
  });
  await page.reload();
  await page.locator('[data-field="name"]').fill("Temporary editor work");
  await page.waitForFunction(() =>
    document
      .querySelector("#save-status")
      .textContent.includes("Recover previous draft"),
  );
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
    originalBrokenDraft,
  );
  await page.locator('[data-action="tools"]').click();
  const recoveryDownload = page.waitForEvent("download");
  await page.locator('#dialog [data-action="download-recovery"]').click();
  assert.equal(
    await downloadedText(await recoveryDownload),
    originalBrokenDraft,
  );
  results.push(
    "An unreadable saved draft stays intact and can be downloaded for recovery",
  );
  await page.locator('#dialog [data-action="fresh"]').click();
  await page.locator('#dialog [data-action="confirm-fresh"]').click();
  assert.deepEqual(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).projects,
      storageKey,
    ),
    [],
  );
  assert.equal(
    await page.locator("#save-status").textContent(),
    "Saved on this device",
  );
  assert.deepEqual(runtimeErrors, []);
  results.push(
    "Only an explicit replacement confirmation releases recovery protection",
  );
  const firstUseContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const firstUse = await firstUseContext.newPage();
  firstUse.on("pageerror", (error) => runtimeErrors.push(error.message));
  await firstUse.goto(base);
  await firstUse
    .locator('[data-action="use-template"][data-id="studio"]')
    .click();
  assert.equal(
    await firstUse.locator('[data-field="name"]').inputValue(),
    "Rowan Ellis",
  );
  assert.equal(
    await firstUse.locator('[data-field="profession"]').inputValue(),
    "developer",
  );
  results.push(
    "First use of Project Studio matches its fictional developer preview",
  );
  await firstUse.locator('[data-field="name"]').fill("My own creator name");
  await firstUse
    .getByRole("button", { name: "Templates", exact: true })
    .click();
  await firstUse
    .locator('[data-action="use-template"][data-id="gallery"]')
    .click();
  assert.equal(
    await firstUse.locator('[data-field="name"]').inputValue(),
    "My own creator name",
  );
  assert.equal(
    await firstUse.locator('[data-field="profession"]').inputValue(),
    "developer",
  );
  results.push(
    "Later template switches preserve edited creator content and profession",
  );
  assert.deepEqual(runtimeErrors, []);
  await firstUseContext.close();
  completed = true;
  console.log(
    JSON.stringify(
      { status: "passed", checks: results.length, results },
      null,
      2,
    ),
  );
} finally {
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/draft-browser-report.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        status: completed ? "passed" : "failed",
        node: process.version,
        browserVersion: browser?.version(),
        checks: results.length,
        results,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  server.kill();
}
