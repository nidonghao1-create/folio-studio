import { escapeHtml, safeUrl, safeEmail } from "./model.js";

const TEMPLATE_IDS = new Set(["editorial", "gallery", "studio", "room"]);
const ACCENTS = {
  "#d05c36": "terracotta",
  "#df6c43": "terracotta",
  "#e66a45": "terracotta",
  "#6d5efc": "violet",
  "#7c5cfc": "violet",
  "#7357e8": "violet",
  "#287a65": "forest",
  "#2b806b": "forest",
  "#16a085": "forest",
  "#2864d8": "blue",
  "#2563eb": "blue",
  "#3b82f6": "blue",
  "#d48b19": "amber",
  "#e9a633": "amber",
  "#f59e0b": "amber",
  "#be4b75": "rose",
  "#d1517b": "rose",
  "#ec4899": "rose",
};

const e = (value) => escapeHtml(String(value ?? ""));
const number = (index) => String(index + 1).padStart(2, "0");
const projectId = (index) => `fp-project-${index + 1}`;
const validImage = (value) =>
  typeof value === "string" &&
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value);

function textParagraphs(value, className = "") {
  return String(value ?? "")
    .split(/\n\s*\n/)
    .filter((part) => part.trim())
    .map(
      (part) => `<p${className ? ` class="${className}"` : ""}>${e(part)}</p>`,
    )
    .join("");
}

function externalLink(value, label, className = "fp-link") {
  const url = safeUrl(value);
  return url
    ? `<a class="${className}" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}<span aria-hidden="true"> ↗</span></a>`
    : "";
}

function contactLinks(doc, className = "fp-contact") {
  const email = safeEmail(doc.email);
  const githubProfile = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(
    doc.github || "",
  )
    ? `https://github.com/${doc.github}`
    : safeUrl(doc.github);
  const github = externalLink(githubProfile, "GitHub", "fp-contact-link");
  const mail = email
    ? `<a class="fp-contact-link" href="mailto:${e(encodeURIComponent(email))}">${e(email)}<span aria-hidden="true"> ↗</span></a>`
    : "";
  return mail || github
    ? `<div class="${className}">${mail}${github}</div>`
    : "";
}

function sampleNotice(doc) {
  return doc.sample
    ? '<div class="fp-sample"><span class="fp-sample-dot" aria-hidden="true"></span><strong>Sample portfolio</strong><span>Fictional projects · Replace with your own work</span></div>'
    : "";
}

function projectTags(project) {
  return Array.isArray(project.tags) && project.tags.length
    ? `<ul class="fp-tags" aria-label="Project tags">${project.tags.map((tag) => `<li>${e(tag)}</li>`).join("")}</ul>`
    : "";
}

function projectLinks(project, profession) {
  const primary = externalLink(
    project.url,
    profession === "developer" ? "Open project" : "View project",
    "fp-button",
  );
  const source = externalLink(
    project.source,
    "Source code",
    "fp-link fp-link--source",
  );
  return primary || source
    ? `<div class="fp-project-actions">${primary}${source}</div>`
    : '<p class="fp-no-link">No public link added</p>';
}

function caseStudy(project) {
  const sections = [
    ["Challenge", project.challenge],
    ["Solution", project.solution],
    ["Outcome", project.outcome],
  ].filter(([, content]) => String(content ?? "").trim());
  if (!sections.length) return "";
  return `<details class="fp-case"><summary><span>Read the case study</span><span class="fp-case-plus" aria-hidden="true">+</span></summary><div class="fp-case-content">${sections.map(([label, content]) => `<section><h4>${label}</h4>${textParagraphs(content)}</section>`).join("")}</div></details>`;
}

function projectMeta(project, index) {
  return `<div class="fp-project-meta"><span class="fp-project-number">${number(index)}</span><span>${e(project.category || "Project")}</span>${project.featured ? '<span class="fp-featured">Featured</span>' : ""}</div>`;
}

function projectArt(project, index, { caption = true } = {}) {
  if (validImage(project.image)) {
    return `<figure class="fp-art fp-art--image"><img src="${e(project.image)}" alt="${e(project.title || "Project")} — project image" loading="lazy" decoding="async" /></figure>`;
  }
  return `<figure class="fp-art fp-art--abstract fp-art--${index % 4}"><div class="fp-art-shape fp-art-shape--one" aria-hidden="true"></div><div class="fp-art-shape fp-art-shape--two" aria-hidden="true"></div><div class="fp-art-shape fp-art-shape--three" aria-hidden="true"></div><span class="fp-art-index" aria-hidden="true">${number(index)}</span>${caption ? "<figcaption>Abstract placeholder</figcaption>" : ""}</figure>`;
}

function pageFooter(doc) {
  return `<footer class="fp-footer"><div><span class="fp-footer-name">${e(doc.name || "Your name")}</span>${doc.location ? `<span>${e(doc.location)}</span>` : ""}</div>${contactLinks(doc)}<a class="fp-top-link" href="#fp-top">Back to top <span aria-hidden="true">↑</span></a></footer>`;
}

function emptyProjects() {
  return '<div class="fp-empty"><span class="fp-eyebrow">A beginning</span><h2>Good things are taking shape.</h2><p>New work will find a home here soon.</p></div>';
}

function editorial(doc) {
  return `<div class="fp-editorial-shell">
    <header class="fp-masthead"><a class="fp-wordmark" href="#fp-top">${e(doc.name || "Your name")}</a><span>${e(doc.role || "Independent creator")}</span><a class="fp-nav-link" href="#fp-work">Selected work <span aria-hidden="true">↓</span></a></header>
    ${sampleNotice(doc)}
    <section class="fp-editorial-hero" aria-labelledby="fp-heading"><div><span class="fp-eyebrow">${e(doc.role || "An independent practice")}${doc.location ? ` · ${e(doc.location)}` : ""}</span><h1 id="fp-heading">${e(doc.tagline || "Thoughtful work. Made personal.")}</h1></div><div class="fp-editorial-intro"><span class="fp-intro-mark" aria-hidden="true">✳</span>${textParagraphs(doc.bio)}${contactLinks(doc)}</div></section>
    <section id="fp-work" class="fp-editorial-work" aria-labelledby="fp-work-heading"><div class="fp-section-heading"><h2 id="fp-work-heading">Selected work</h2><span>${String(doc.projects.length).padStart(2, "0")} projects</span></div>
    ${doc.projects.length ? doc.projects.map((project, index) => `<article id="${projectId(index)}" class="fp-editorial-project"><div class="fp-editorial-project-label">${projectMeta(project, index)}<h3>${e(project.title || "Untitled project")}</h3>${projectTags(project)}</div><div class="fp-editorial-project-body">${projectArt(project, index)}${textParagraphs(project.description, "fp-project-description")}${projectLinks(project, doc.profession)}${caseStudy(project)}</div></article>`).join("") : emptyProjects()}
    </section>${pageFooter(doc)}</div>`;
}

function gallery(doc) {
  return `<div class="fp-gallery-shell">
    <header class="fp-masthead"><a class="fp-wordmark" href="#fp-top">${e(doc.name || "Your name")}<span class="fp-wordmark-dot" aria-hidden="true">.</span></a><a class="fp-nav-link" href="#fp-work">The collection <span aria-hidden="true">↓</span></a></header>
    ${sampleNotice(doc)}
    <section class="fp-gallery-hero" aria-labelledby="fp-heading"><div><span class="fp-eyebrow">${e(doc.role || "Independent creator")}${doc.location ? ` · ${e(doc.location)}` : ""}</span><h1 id="fp-heading">${e(doc.tagline || "A collection of things I care about.")}</h1></div><div class="fp-gallery-intro">${textParagraphs(doc.bio)}${contactLinks(doc)}</div></section>
    <section id="fp-work" aria-labelledby="fp-work-heading"><div class="fp-section-heading"><h2 id="fp-work-heading">The collection</h2><span>${String(doc.projects.length).padStart(2, "0")} pieces of work</span></div><div class="fp-gallery-grid">
    ${doc.projects.length ? doc.projects.map((project, index) => `<article id="${projectId(index)}" class="fp-gallery-project${project.featured ? " fp-gallery-project--featured" : ""}">${projectArt(project, index)}<div class="fp-gallery-project-content">${projectMeta(project, index)}<h3>${e(project.title || "Untitled project")}</h3>${textParagraphs(project.description, "fp-project-description")}${projectTags(project)}${projectLinks(project, doc.profession)}${caseStudy(project)}</div></article>`).join("") : emptyProjects()}
    </div></section><section class="fp-gallery-end"><span class="fp-eyebrow">The next good thing starts with a conversation.</span><h2>Let’s make<br />something matter.</h2>${contactLinks(doc)}</section>${pageFooter(doc)}</div>`;
}

function studio(doc) {
  return `<div class="fp-studio-shell">
    <header class="fp-studio-topbar"><a class="fp-wordmark" href="#fp-top"><span class="fp-studio-symbol" aria-hidden="true">[ / ]</span>${e(doc.name || "Your name")}</a><span class="fp-studio-state"><span aria-hidden="true"></span>Independent ${doc.profession === "developer" ? "developer" : "creator"}</span><a class="fp-nav-link" href="#fp-work">Projects <span aria-hidden="true">↓</span></a></header>
    ${sampleNotice(doc)}
    <section class="fp-studio-hero" aria-labelledby="fp-heading"><div class="fp-studio-heading"><span class="fp-eyebrow">${e(doc.role || "Building things for the web")}</span><h1 id="fp-heading">${e(doc.tagline || "Ideas into things that work.")}</h1>${contactLinks(doc)}</div><aside class="fp-studio-about"><div class="fp-panel-label"><span>ABOUT / ${e(doc.name || "Creator")}</span><span aria-hidden="true">↗</span></div><div class="fp-studio-about-copy">${textParagraphs(doc.bio)}${doc.location ? `<p class="fp-studio-location"><span aria-hidden="true">⌖</span> ${e(doc.location)}</p>` : ""}</div><div class="fp-studio-panel-footer"><span>${doc.projects.length} selected ${doc.projects.length === 1 ? "project" : "projects"}</span><span>Made with intention</span></div></aside></section>
    <section id="fp-work" aria-labelledby="fp-work-heading"><div class="fp-section-heading"><h2 id="fp-work-heading"><span class="fp-studio-slash" aria-hidden="true">/</span> Projects</h2><span>Build · Share · Iterate</span></div><div class="fp-studio-grid">
    ${doc.projects.length ? doc.projects.map((project, index) => `<article id="${projectId(index)}" class="fp-studio-project"><div class="fp-studio-project-titlebar"><span>${number(index)} / ${e(project.category || "Project")}</span>${project.featured ? '<span class="fp-featured">Featured</span>' : '<span aria-hidden="true">↗</span>'}</div>${projectArt(project, index)}<div class="fp-studio-project-content"><h3>${e(project.title || "Untitled project")}</h3>${textParagraphs(project.description, "fp-project-description")}${projectTags(project)}${projectLinks(project, doc.profession)}${caseStudy(project)}</div></article>`).join("") : emptyProjects()}
    </div></section>${pageFooter(doc)}</div>`;
}

function roomObject(project, index) {
  const type = ["monitor", "frame", "stack", "portal"][index % 4];
  return `<a class="fp-room-object fp-room-object--${type}" href="#${projectId(index)}" aria-label="Explore ${e(project.title || "Untitled project")}"><div class="fp-room-display" aria-hidden="true"><div class="fp-room-plinth"></div><div class="fp-room-sculpture"><span class="fp-room-sculpture-inner">${number(index)}</span></div><span class="fp-room-object-shadow"></span></div><div class="fp-room-object-label"><span class="fp-room-label-number">${number(index)}</span><span>${e(project.title || "Untitled project")}</span><span class="fp-room-label-arrow" aria-hidden="true">↗</span></div></a>`;
}

function room(doc) {
  return `<div class="fp-room-shell">
    <header class="fp-masthead"><a class="fp-wordmark" href="#fp-top">${e(doc.name || "Your name")}<span class="fp-room-wordmark-sub">A personal exhibition</span></a><a class="fp-nav-link" href="#fp-work">Exhibit notes <span aria-hidden="true">↓</span></a></header>
    ${sampleNotice(doc)}
    <section class="fp-room-hero" aria-labelledby="fp-heading"><div><span class="fp-eyebrow">${e(doc.role || "Independent creator")}${doc.location ? ` · ${e(doc.location)}` : ""}</span><h1 id="fp-heading">${e(doc.tagline || "A little space for big ideas.")}</h1></div><div class="fp-room-intro">${textParagraphs(doc.bio)}${contactLinks(doc)}</div></section>
    <section class="fp-room-exhibition" aria-labelledby="fp-room-heading"><div class="fp-room-exhibition-heading"><h2 id="fp-room-heading">Step into my work.</h2><p>Select an object to explore a project.</p></div><div class="fp-room-stage"><div class="fp-room-architecture" aria-hidden="true"><span class="fp-room-wall fp-room-wall--left"></span><span class="fp-room-wall fp-room-wall--right"></span><span class="fp-room-skylight"></span><span class="fp-room-floor"></span></div><div class="fp-room-objects">${doc.projects.length ? doc.projects.map(roomObject).join("") : '<p class="fp-room-stage-empty">A place for the next idea.</p>'}</div><div class="fp-room-stage-caption"><span>Personal exhibition</span><span>${String(doc.projects.length).padStart(2, "0")} exhibits</span></div></div></section>
    <section id="fp-work" class="fp-room-records" aria-labelledby="fp-work-heading"><div class="fp-section-heading"><h2 id="fp-work-heading">Exhibit notes</h2><span>A closer look at the work</span></div>${doc.projects.length ? doc.projects.map((project, index) => `<article id="${projectId(index)}" class="fp-room-record"><div class="fp-room-record-number" aria-hidden="true">${number(index)}</div><div class="fp-room-record-content">${projectMeta(project, index)}<h3>${e(project.title || "Untitled project")}</h3>${textParagraphs(project.description, "fp-project-description")}${projectTags(project)}${projectLinks(project, doc.profession)}${caseStudy(project)}</div>${projectArt(project, index)}</article>`).join("") : emptyProjects()}</section>${pageFooter(doc)}</div>`;
}

/** Render normalized creator content for both sandboxed previews and static export. */
export function renderPortfolio(doc, { compact = false } = {}) {
  const template = TEMPLATE_IDS.has(doc.template) ? doc.template : "editorial";
  const accent = ACCENTS[String(doc.accent ?? "").toLowerCase()] || "default";
  const accentStyle = /^#[0-9a-fA-F]{6}$/.test(doc.accent)
    ? ` style="--fp-accent:${doc.accent.toLowerCase()}"`
    : "";
  const render = { editorial, gallery, studio, room }[template];
  return `<main id="fp-top" class="fp fp--${template}${compact ? " fp--compact" : ""}${doc.motion === false ? " fp--still" : ""}" data-accent="${accent}"${accentStyle}><a class="fp-skip-link" href="#fp-work">Skip to projects</a>${render(doc)}</main>`;
}
