import test from "node:test";
import assert from "node:assert/strict";
import { createSample, escapeHtml, TEMPLATES } from "../src/model.js";
import { renderPortfolio } from "../src/render.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";
function creatorDoc() {
  const doc = createSample("developer");
  Object.assign(doc, {
    sample: false,
    name: "Creator & Co",
    role: "Independent maker",
    tagline: "Useful things, thoughtfully made.",
    bio: "First biography paragraph.\n\nSecond biography paragraph.",
    location: "Home studio",
    email: "creator+work@example.com",
    github: "creative-person",
  });
  doc.projects = [
    {
      ...doc.projects[0],
      title: "My <real> project",
      category: "Browser tool",
      description: "Known project description.",
      challenge: "Known challenge.",
      solution: "Known approach.",
      outcome: "Known outcome.",
      tags: ["Local-first", "Accessible"],
      url: "https://example.com/work",
      source: "https://github.com/creative-person/work",
      image: png,
      featured: true,
    },
  ];
  return doc;
}

test("four templates have distinct structures while preserving creator and case-study content", () => {
  const shells = new Set();
  const doc = creatorDoc();
  for (const { id } of TEMPLATES) {
    const html = renderPortfolio({ ...doc, template: id });
    const shell = html.match(
      /class="(fp-(?:editorial|gallery|studio|room)-shell)"/,
    );
    assert.ok(shell, `${id} has a distinct shell`);
    shells.add(shell[1]);
    for (const content of [
      doc.name,
      doc.role,
      doc.tagline,
      doc.location,
      "First biography paragraph.",
      "Second biography paragraph.",
      doc.projects[0].title,
      doc.projects[0].category,
      doc.projects[0].description,
      doc.projects[0].challenge,
      doc.projects[0].solution,
      doc.projects[0].outcome,
      ...doc.projects[0].tags,
    ]) {
      assert.ok(
        html.includes(escapeHtml(content)),
        `${id} preserves ${content}`,
      );
    }
    assert.match(html, /<details class="fp-case"><summary>/);
    assert.match(html, /<h4>Challenge<\/h4>/);
    assert.match(html, /<h4>Solution<\/h4>/);
    assert.match(html, /<h4>Outcome<\/h4>/);
    assert.match(html, /href="https:\/\/example.com\/work"/);
    assert.match(html, /href="https:\/\/github.com\/creative-person\/work"/);
    assert.match(html, /<img src="data:image\/png;base64,/);
  }
  assert.equal(shells.size, 4);
});

test("untrusted text cannot become elements, event handlers or attributes in any template", () => {
  const doc = creatorDoc();
  const payload =
    '<script>alert("x")</script><img src=x onerror="alert(1)"> & \'quoted\'';
  for (const field of ["name", "role", "tagline", "bio", "location"])
    doc[field] = payload;
  for (const field of [
    "title",
    "category",
    "description",
    "challenge",
    "solution",
    "outcome",
  ])
    doc.projects[0][field] = payload;
  doc.projects[0].tags = [payload];
  for (const { id } of TEMPLATES) {
    const html = renderPortfolio({ ...doc, template: id });
    assert.ok(html.includes(escapeHtml(payload)));
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<img\s+src=x/i);
    // Ignore inert words inside quoted attribute values (for example image alt text).
    const tags = [...html.matchAll(/<\/?[a-z][^>]*>/gi)]
      .map(([tag]) => tag.replace(/"[^"]*"|'[^']*'/g, '""'))
      .join("");
    assert.doesNotMatch(tags, /\son(?:error|load|click)\s*=/i);
    assert.doesNotMatch(html, /aria-label="Explore <script/);
  }
});

test("dangerous project URLs and unsafe image data URLs are rejected at the rendering boundary", () => {
  const doc = creatorDoc();
  for (const image of [
    "data:text/html,<script>alert(1)</script>",
    "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=",
    "https://remote.example/image.png",
    'data:image/png;base64,abc" onerror="alert(1)',
  ]) {
    doc.projects[0].image = image;
    doc.projects[0].url = "javascript:alert(1)";
    doc.projects[0].source = "data:text/html,<script>alert(1)</script>";
    for (const { id } of TEMPLATES) {
      const html = renderPortfolio({ ...doc, template: id });
      assert.doesNotMatch(html, /href="(?:javascript|data|file):/i);
      assert.doesNotMatch(html, /<img\b/);
      assert.match(html, /Abstract placeholder/);
      assert.match(html, /No public link added/);
    }
  }
});

test("a repository without a homepage still has its real source, without a fabricated demo action", () => {
  const doc = creatorDoc();
  doc.projects[0].url = "";
  doc.projects[0].image = "";
  const html = renderPortfolio(doc);
  assert.match(html, />Source code<span/);
  assert.doesNotMatch(html, />Open project<span/);
  assert.doesNotMatch(html, /href="#"|href=""/);
  doc.projects[0].source = "";
  const unlinked = renderPortfolio(doc);
  assert.match(unlinked, /No public link added/);
  assert.doesNotMatch(unlinked, /fp-project-actions/);
});

test("external project and contact links open safely", () => {
  const html = renderPortfolio(creatorDoc());
  const links = [...html.matchAll(/<a\b[^>]+href="https?:[^>]+>/g)].map(
    ([tag]) => tag,
  );
  assert.ok(links.length >= 3);
  for (const tag of links) {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  }
  assert.match(html, /href="mailto:creator(?:\+|%2B)work(?:@|%40)example.com"/);
});

test("mailto contact escapes valid reserved characters rather than changing the recipient", () => {
  const doc = creatorDoc();
  doc.email = "maker#work@example.com";
  const html = renderPortfolio(doc);
  assert.match(html, /href="mailto:[^"]*%23[^"]*"/);
  assert.doesNotMatch(html, /href="mailto:maker#work/);
});

test("unsafe or absent emails do not generate mailto links", () => {
  for (const email of [
    "",
    "creator@example.com?bcc=other@example.com",
    "creator@example.com\r\nBcc:other@example.com",
  ]) {
    const html = renderPortfolio({ ...creatorDoc(), email });
    assert.doesNotMatch(html, /href="mailto:/);
  }
});

test("sample notices and abstract placeholders are explicit and can be distinguished from creator images", () => {
  const sample = renderPortfolio(createSample());
  assert.match(sample, /Sample portfolio/);
  assert.match(sample, /Fictional projects · Replace with your own work/);
  assert.match(sample, /Abstract placeholder/);
  assert.doesNotMatch(sample, /<img\b/);
  const own = renderPortfolio(creatorDoc());
  assert.doesNotMatch(own, /class="fp-sample"/);
  assert.match(own, /alt="My &lt;real&gt; project — project image"/);
});

test("room objects are ordinary keyboard-operable anchors with matching readable project records", () => {
  const doc = createSample();
  const html = renderPortfolio({ ...doc, template: "room" });
  const objects = [
    ...html.matchAll(
      /<a class="fp-room-object[^>]+href="#(fp-project-\d+)"[^>]+aria-label="Explore ([^"]+)"/g,
    ),
  ];
  assert.equal(objects.length, doc.projects.length);
  for (const [, target, label] of objects) {
    assert.ok(html.includes(`id="${target}"`));
    assert.ok(label.trim());
  }
  assert.equal(
    new Set(objects.map(([, target]) => target)).size,
    doc.projects.length,
  );
  assert.doesNotMatch(html, /<canvas\b|<script\b|tabindex="-1"/);
  assert.match(html, /Skip to projects/);
  assert.match(html, /id="fp-work"/);
  assert.match(html, /<h1 id="fp-heading">/);
});

test("reduced motion, compact preview and empty draft states remain functional", () => {
  const html = renderPortfolio(
    { ...creatorDoc(), motion: false },
    { compact: true },
  );
  assert.match(html, /fp--compact/);
  assert.match(html, /fp--still/);
  for (const { id } of TEMPLATES) {
    const empty = renderPortfolio({
      ...creatorDoc(),
      projects: [],
      template: id,
    });
    assert.match(empty, /Good things are taking shape/);
    assert.doesNotMatch(empty, /id="fp-project-\d+"/);
  }
});

test("template and accent values cannot inject CSS or HTML into markup", () => {
  const html = renderPortfolio({
    ...creatorDoc(),
    template: 'room" onclick="alert(1)',
    accent: "#fff; background:url(javascript:alert(1))",
  });
  assert.match(html, /fp--editorial/);
  assert.doesNotMatch(html, /onclick=|background:url|style="/);
});
