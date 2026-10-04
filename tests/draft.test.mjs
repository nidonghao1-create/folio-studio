import test from "node:test";
import assert from "node:assert/strict";
import { createSample, validatePortfolio } from "../src/model.js";
import { restoreDraft, serializeDraft } from "../src/draft.js";
import { renderPortfolio } from "../src/render.js";
import { exportWebsite } from "../src/export.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";

test("unfinished URLs and email survive local restore and repeated portable backup round-trips", () => {
  let doc = createSample();
  doc.email = "creator@";
  doc.projects[0].url = "https://";
  doc.projects[0].source = "https://github.com/";
  const expected = structuredClone(doc);
  for (let i = 0; i < 3; i++) doc = restoreDraft(serializeDraft(doc));
  assert.deepEqual(doc, expected);
  assert.ok(
    validatePortfolio(doc).some((error) => error.includes("valid email")),
  );
  assert.ok(
    validatePortfolio(doc).some((error) => error.includes("project link")),
  );
});

test("draft preservation does not allow unsafe URLs or email to become executable or publishable", () => {
  const doc = createSample();
  doc.email = "creator@example.com?bcc=other@example.com";
  doc.projects[0].url = "javascript:alert(1)";
  doc.projects[0].source = "data:text/html,<script>alert(2)</script>";
  const restored = restoreDraft(serializeDraft(doc));
  assert.equal(restored.email, doc.email);
  assert.equal(restored.projects[0].url, doc.projects[0].url);
  const html = renderPortfolio(restored);
  assert.doesNotMatch(html, /href="(?:javascript:|data:|mailto:)/i);
  assert.doesNotMatch(html, /<script\b/i);
  assert.throws(
    () => exportWebsite(restored, ""),
    /valid email|project link|source link/,
  );
});

test("unfinished fields cannot bypass strict schema, image and project-count checks", () => {
  const base = createSample();
  for (const edit of [
    { email: 42 },
    { email: "a".repeat(255) },
    { name: 42 },
    { projects: [null] },
    { projects: [7] },
    { projects: [[]] },
    {
      projects: [{ ...base.projects[0], url: { href: "https://example.com" } }],
    },
    { projects: [{ ...base.projects[0], source: "x".repeat(2049) }] },
    {
      projects: [
        {
          ...base.projects[0],
          image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        },
      ],
    },
    {
      projects: Array.from({ length: 13 }, (_, i) => ({
        ...base.projects[0],
        id: `p-${i}`,
      })),
    },
  ])
    assert.throws(() => restoreDraft(JSON.stringify({ ...base, ...edit })));
});

test("a draft with a valid image and an unfinished link remains backup-safe", () => {
  const doc = createSample();
  doc.email = "unfinished";
  doc.projects[0].url = "http";
  doc.projects[0].image = png;
  const restored = restoreDraft(serializeDraft(doc));
  assert.equal(restored.projects[0].image, png);
  assert.equal(restored.projects[0].url, "http");
  assert.equal(restored.email, "unfinished");
});

test("blank unfinished portfolios are restorable without the export completion requirement", () => {
  const restored = restoreDraft('{"version":1,"projects":[],"email":"@"}');
  assert.equal(restored.name, "");
  assert.equal(restored.email, "@");
  assert.deepEqual(restored.projects, []);
  assert.ok(validatePortfolio(restored).length);
});

test("malformed and unsupported backups fail explicitly", () => {
  for (const value of [
    "{",
    "null",
    "[]",
    "{}",
    '{"version":2,"projects":[]}',
    '{"version":1,"projects":{}}',
    null,
  ])
    assert.throws(() => restoreDraft(value));
});

test("backup file size is enforced in UTF-8 bytes, not only JavaScript character count", () => {
  const padded = `${JSON.stringify(createSample())}${" ".repeat(8 * 1024 * 1024)}`;
  assert.throws(() => restoreDraft(padded), /8 MB/);
  const multiByte = JSON.stringify({
    version: 1,
    projects: [],
    ignored: "界".repeat(3 * 1024 * 1024),
  });
  assert.ok(multiByte.length < 8 * 1024 * 1024);
  assert.throws(() => restoreDraft(multiByte), /8 MB/);
});

test("unknown keys and prototype-shaped data cannot change restored object behavior", () => {
  const restored = restoreDraft(
    '{"version":1,"projects":[],"__proto__":{"polluted":true},"script":"alert(1)"}',
  );
  assert.equal(Object.hasOwn(restored, "__proto__"), false);
  assert.equal(Object.hasOwn(restored, "script"), false);
  assert.equal({}.polluted, undefined);
});

test("valid completed project backups retain every field and preserve the input object", () => {
  const doc = createSample("developer");
  doc.sample = false;
  doc.email = "creator+work@example.com";
  doc.projects[0].url = "https://example.com/";
  const original = structuredClone(doc);
  assert.deepEqual(restoreDraft(serializeDraft(doc)), original);
  assert.deepEqual(doc, original);
});
