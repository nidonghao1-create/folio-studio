import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createSample,
  parseImport,
  escapeHtml,
  TEMPLATES,
} from "../src/model.js";
import { exportWebsite, projectFilename } from "../src/export.js";
import { renderPortfolio } from "../src/render.js";
import { LICENSE_TEXT } from "../src/license.js";

const css = await readFile(
  new URL("../src/templates.css", import.meta.url),
  "utf8",
);
const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");

test("export is one English HTML document containing the same renderer and local stylesheet", () => {
  const doc = createSample();
  const html = exportWebsite(doc, css);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /name="viewport"/);
  assert.ok(html.includes(renderPortfolio(doc)));
  assert.ok(html.includes(css));
  assert.doesNotMatch(
    html,
    /<script\b|<iframe\b|<link\b[^>]+(?:stylesheet|preload)/i,
  );
  assert.doesNotMatch(html, /(?:src|srcset)="https?:/i);
  assert.doesNotMatch(css, /@import\b|url\([\s"']*https?:/i);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media\s+print/);
});

test("full Apache license is preserved with creator content rights separated from template code", () => {
  assert.equal(LICENSE_TEXT.trim(), license.trim());
  const html = exportWebsite(createSample(), css);
  const comment = html.slice(html.indexOf("<!--") + 4, html.indexOf("-->"));
  assert.ok(comment.includes(LICENSE_TEXT));
  assert.match(comment, /Copyright 2026 Folio Studio contributors/);
  assert.match(
    comment,
    /The creator retains rights to their own content and images/,
  );
  assert.match(comment, /Grant of Copyright License/);
  assert.match(comment, /Grant of Patent License/);
  assert.match(comment, /END OF TERMS AND CONDITIONS/);
});

test("all templates export their own structure without losing projects or cases", () => {
  const doc = createSample("developer");
  for (const { id } of TEMPLATES) {
    const html = exportWebsite({ ...doc, template: id }, css);
    assert.ok(html.includes(`fp-${id}-shell`));
    for (const project of doc.projects) {
      for (const field of [
        "title",
        "description",
        "challenge",
        "solution",
        "outcome",
      ])
        assert.ok(html.includes(escapeHtml(project[field])));
    }
    assert.equal(
      (html.match(/id="fp-project-\d+"/g) ?? []).length,
      doc.projects.length,
    );
  }
});

test("creator text cannot break title, metadata, attributes, or the HTML document", () => {
  const doc = createSample();
  doc.name = "</title><script>alert(1)</script>";
  doc.role = '" onload="alert(1)';
  doc.tagline = '"><script>alert(2)</script>';
  doc.projects[0].title = "<img src=x onerror=alert(3)>";
  const html = exportWebsite(doc, css);
  assert.ok(
    html.includes(
      `<title>${escapeHtml(doc.name)} — ${escapeHtml(doc.role)}</title>`,
    ),
  );
  assert.ok(
    html.includes(`name="description" content="${escapeHtml(doc.tagline)}"`),
  );
  assert.doesNotMatch(html, /<script\b|<img\s+src=x|<[^>]+\sonload="alert/i);
  assert.equal((html.match(/<body>/g) ?? []).length, 1);
  assert.equal((html.match(/<\/html>/g) ?? []).length, 1);
});

test("incomplete drafts and unsafe content do not export as successful websites", () => {
  const doc = createSample();
  assert.throws(() => exportWebsite({ ...doc, name: "" }, css), /your name/);
  assert.throws(
    () => exportWebsite({ ...doc, projects: [] }, css),
    /at least one project/,
  );
  assert.throws(
    () =>
      exportWebsite(
        { ...doc, email: "creator@example.com?bcc=other@example.com" },
        css,
      ),
    /valid email/,
  );
  const broken = structuredClone(doc);
  broken.projects[0].source = "javascript:alert(1)";
  assert.throws(() => exportWebsite(broken, css), /http:\/\/ or https:\/\//);
  broken.projects[0].source = "";
  broken.projects[0].image = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
  assert.throws(() => exportWebsite(broken, css), /image/);
});

test("empty homepage metadata does not turn into a demo link during export", () => {
  const doc = createSample("developer");
  doc.sample = false;
  doc.projects = [
    {
      ...doc.projects[0],
      url: "",
      source: "https://github.com/creator/work",
      image: "",
    },
  ];
  const html = exportWebsite(doc, css);
  assert.match(html, /href="https:\/\/github.com\/creator\/work"/);
  assert.doesNotMatch(html, />Open project<span|href="#"|href=""/);
});

test("uploaded raster images are embedded rather than creating a missing asset dependency", () => {
  const doc = createSample();
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";
  doc.projects[0].image = image;
  const html = exportWebsite(doc, css);
  assert.ok(html.includes(`src="${image}"`));
  assert.doesNotMatch(html, /src="(?:\.\.?\/|\/assets\/|https?:)/);
});

test("a JSON project backup round-trips editable content and malformed import cannot become an export", () => {
  const doc = createSample();
  const restored = parseImport(JSON.stringify(doc, null, 2));
  assert.deepEqual(restored, doc);
  assert.equal(exportWebsite(restored, css), exportWebsite(doc, css));
  assert.throws(() => parseImport(exportWebsite(doc, css)), /not valid JSON/);
  assert.throws(
    () =>
      parseImport(
        '{"version":1,"projects":[{"title":"Broken","url":"javascript:alert(1)"}]}',
      ),
    /project link/,
  );
  assert.throws(() => parseImport('{"version":99,"projects":[]}'), /version 1/);
});

test("download filenames cannot contain path traversal or unsafe filename characters", () => {
  assert.equal(
    projectFilename("Avery Morgan", ".folio.json"),
    "avery-morgan.folio.json",
  );
  assert.equal(projectFilename("作品 🌿", ".html"), "my-portfolio.html");
  for (const name of [
    "../../sensitive",
    "/etc/passwd",
    "a\\b\\c",
    "<script>alert(1)</script>",
    ' "quoted":name*? ',
    "a".repeat(500),
  ]) {
    const filename = projectFilename(name, ".folio.json");
    assert.match(filename, /^[a-z\d-]{1,60}\.folio\.json$/);
    assert.doesNotMatch(filename, /[\/\\<>:"*?]/);
  }
});
