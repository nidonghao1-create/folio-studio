import test from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATES,
  createSample,
  normalizePortfolio,
  validatePortfolio,
  escapeHtml,
  safeUrl,
  safeEmail,
  parseImport,
  reorderProjects,
  withProject,
  removeProject,
} from "../src/model.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";

test("four templates preserve the same portfolio content", () => {
  assert.deepEqual(
    TEMPLATES.map(({ id }) => id),
    ["editorial", "gallery", "studio", "room"],
  );
  const original = createSample();
  for (const { id } of TEMPLATES) {
    const doc = normalizePortfolio({ ...original, template: id });
    assert.deepEqual(doc.projects, original.projects);
    assert.equal(doc.template, id);
  }
});

test("designer and developer examples are explicitly fictional and have no fabricated demo or source", () => {
  for (const profession of ["designer", "developer"]) {
    const doc = createSample(profession);
    assert.equal(doc.sample, true);
    assert.equal(doc.projects.length, 3);
    assert.match(doc.bio, /fictional sample/i);
    assert.match(doc.role, /Fictional sample/);
    for (const project of doc.projects) {
      assert.match(project.description, /fictional|imagined/i);
      assert.match(project.outcome, /sample|fictional/i);
      assert.equal(project.url, "");
      assert.equal(project.source, "");
      assert.equal(project.image, "");
    }
    assert.deepEqual(validatePortfolio(doc), []);
  }
  assert.throws(() => createSample("unsupported"), /designer or developer/);
});

test("normalization keeps ordinary text inert and drops all unknown import properties", () => {
  const input = JSON.parse(
    '{"version":1,"name":" <img src=x onerror=alert(1)> ","projects":[],"__proto__":{"polluted":true},"script":"alert(1)"}',
  );
  const doc = normalizePortfolio(input);
  assert.equal(doc.name, "<img src=x onerror=alert(1)>");
  assert.equal(Object.hasOwn(doc, "__proto__"), false);
  assert.equal(Object.hasOwn(doc, "script"), false);
  assert.equal({}.polluted, undefined);
  assert.equal(escapeHtml(doc.name), "&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(
    escapeHtml("a & \"b\" <c> 'd'"),
    "a &amp; &quot;b&quot; &lt;c&gt; &#39;d&#39;",
  );
});

test("dangerous links cannot survive normalization, and validation explains the problem", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//evil.test",
    "file:///tmp/file",
    "https://person:secret@example.test",
    "https://example.test/\nother",
  ]) {
    assert.equal(safeUrl(url), "");
    const doc = createSample();
    doc.projects[0].url = url;
    assert.match(validatePortfolio(doc).join(" "), /http:\/\/ or https:\/\//);
    assert.throws(() => normalizePortfolio(doc), /project link/);
    assert.throws(() => parseImport(JSON.stringify(doc)), /project link/);
  }
  assert.equal(
    safeUrl(" HTTPS://example.test/hello?q=one "),
    "https://example.test/hello?q=one",
  );
  assert.equal(
    safeUrl("https://example.test/<script>"),
    "https://example.test/%3Cscript%3E",
  );
  assert.equal(safeUrl(null), "");
});

test("email validation blocks mailto header injection and accepts useful personal addresses", () => {
  assert.equal(
    safeEmail(" creator+work@example.com "),
    "creator+work@example.com",
  );
  for (const value of [
    "a@example.com?bcc=other@example.com",
    "a@example.com\r\nBcc:other@example.com",
    "mailto:a@example.com",
    "a%0a@example.com",
    "a@",
    {},
  ])
    assert.equal(safeEmail(value), "");
  const doc = createSample();
  doc.email = "a@example.com?subject=x";
  assert.match(validatePortfolio(doc).join(" "), /valid email/);
});

test("GitHub profile values normalize to a username without accepting foreign URLs", () => {
  const doc = createSample();
  doc.github = "https://github.com/creative-person/";
  assert.equal(normalizePortfolio(doc).github, "creative-person");
  for (const value of [
    "https://evil.test/person",
    "https://github.com/person?token=secret",
    "person--name",
    "-name",
    "person/repos",
  ]) {
    assert.throws(
      () => normalizePortfolio({ ...doc, github: value }),
      /GitHub/,
    );
  }
});

test("only small raster data URLs matching their format can be stored", () => {
  const doc = createSample();
  doc.projects[0].image = png;
  assert.equal(normalizePortfolio(doc).projects[0].image, png);
  for (const image of [
    "https://example.test/image.png",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/png;base64,PGh0bWw+",
    png.replace("image/png", "image/jpeg"),
    "data:image/png;base64,@@@@",
  ]) {
    doc.projects[0].image = image;
    assert.throws(() => normalizePortfolio(doc), /image/);
  }
  doc.projects[0].image = `data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}`;
  assert.throws(() => normalizePortfolio(doc), /2 MB/);
});

test("malformed backups fail explicitly without changing a current document", () => {
  const current = createSample();
  const snapshot = JSON.stringify(current);
  for (const raw of [
    "{",
    "null",
    "[]",
    "{}",
    '{"version":2,"projects":[]}',
    '{"version":1,"projects":{}}',
  ])
    assert.throws(() => parseImport(raw));
  assert.throws(
    () => parseImport(" ".repeat(8 * 1024 * 1024 + 1)),
    /too large/,
  );
  assert.deepEqual(parseImport(snapshot), current);
  assert.equal(JSON.stringify(current), snapshot);
});

test("invalid shapes, types, project count, duplicate IDs and content lengths are rejected", () => {
  assert.throws(() => normalizePortfolio([]), /JSON object/);
  const original = createSample();
  const broken = [
    { ...original, name: 123 },
    { ...original, accent: "red; background:url(javascript:alert(1))" },
    { ...original, motion: "true" },
    { ...original, sample: "false" },
    { ...original, template: "user-template" },
    { ...original, name: "x".repeat(81) },
    {
      ...original,
      projects: Array.from({ length: 13 }, (_, i) => ({
        ...original.projects[0],
        id: `project-${i}`,
      })),
    },
    { ...original, projects: [original.projects[0], original.projects[0]] },
    { ...original, projects: [{ ...original.projects[0], tags: [null] }] },
    { ...original, projects: [{ ...original.projects[0], featured: "yes" }] },
    { ...original, projects: [null] },
  ];
  for (const input of broken) assert.throws(() => normalizePortfolio(input));
  assert.equal(
    normalizePortfolio({ ...original, tagline: "  One\r\nTwo\u0000  " })
      .tagline,
    "One\nTwo",
  );
});

test("a blank draft is permitted but export validation asks for content", () => {
  const doc = normalizePortfolio({ version: 1, projects: [] });
  assert.equal(doc.sample, false);
  assert.match(validatePortfolio(doc).join(" "), /your name/);
  assert.match(validatePortfolio(doc).join(" "), /at least one project/);
});

test("project edits, reordering and removals are immutable and preserve unrelated work", () => {
  const original = createSample();
  const snapshot = structuredClone(original);
  const moved = reorderProjects(original, 0, 2);
  assert.deepEqual(
    moved.projects.map(({ id }) => id),
    [original.projects[1].id, original.projects[2].id, original.projects[0].id],
  );
  const edited = withProject(original, {
    id: original.projects[0].id,
    title: "My real project",
  });
  assert.equal(edited.projects.length, 3);
  assert.equal(edited.projects[0].title, "My real project");
  assert.equal(
    edited.projects[0].description,
    original.projects[0].description,
  );
  const added = withProject(original, {
    title: "A new work",
    tags: ["One", "One", " Two "],
  });
  assert.equal(added.projects.length, 4);
  assert.deepEqual(added.projects.at(-1).tags, ["One", "Two"]);
  assert.equal(
    removeProject(original, original.projects[0].id).projects.length,
    2,
  );
  assert.deepEqual(original, snapshot);
  assert.throws(
    () => reorderProjects(original, -1, 1),
    /valid project position/,
  );
  assert.throws(
    () => reorderProjects(original, 0, 4),
    /valid project position/,
  );
});
