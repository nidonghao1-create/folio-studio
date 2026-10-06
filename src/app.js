import {
  TEMPLATES,
  createSample,
  normalizePortfolio,
  validatePortfolio,
  escapeHtml as e,
  reorderProjects,
  removeProject,
} from "./model.js";
import { renderPortfolio } from "./render.js";
import { fetchGithubProfile, repositoryToProject } from "./github.js";
import { exportWebsite, projectFilename } from "./export.js";
import { restoreDraft, serializeDraft } from "./draft.js";

const app = document.querySelector("#app");
const dialog = document.querySelector("#dialog");
const STORAGE_KEY = "folio-studio.document.v1";
let doc = createSample("designer");
let view = "templates",
  filter = "all",
  activeProject = "",
  previewDevice = "desktop";
let saveTimer,
  previewTimer,
  toastTimer,
  githubController,
  githubResult,
  dirty = false;
let css = "",
  storageAvailable = true,
  savedAt = null;
let unrestoredDraft = null;
// A local draft may contain a link or email still being typed. Keep those raw
// values in the editor; the renderer and exporter enforce their own boundaries.
function restoreLocalDraft(text) {
  return restoreDraft(text);
}
let storedDraft;
try {
  storedDraft = localStorage.getItem(STORAGE_KEY);
  if (storedDraft) {
    doc = restoreLocalDraft(storedDraft);
    savedAt = new Date();
  }
} catch {
  storageAvailable = false;
  unrestoredDraft = typeof storedDraft === "string" ? storedDraft : null;
}
activeProject = doc.projects[0]?.id || "";

const icon = (name) =>
  ({
    brand: '<span class="brand-mark" aria-hidden="true">f</span>',
    grid: "▦",
    edit: "✎",
    download: "↓",
    close: "×",
    check: "✓",
    plus: "+",
    code: "〈/〉",
  })[name] || "";
function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4500);
}
function save() {
  clearTimeout(saveTimer);
  if (unrestoredDraft !== null) {
    dirty = true;
    document
      .querySelector("#save-status")
      ?.replaceChildren(
        document.createTextNode("Not saved · Recover previous draft"),
      );
    notify(
      "Your previous draft could not be opened. Download the original from Project files before replacing it.",
    );
    return false;
  }
  let text;
  try {
    text = serializeDraft(doc);
  } catch (err) {
    dirty = true;
    document
      .querySelector("#save-status")
      ?.replaceChildren(
        document.createTextNode("Not saved · Check your draft"),
      );
    notify(err.message);
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, text);
    savedAt = new Date();
    storageAvailable = true;
    dirty = false;
    document
      .querySelector("#save-status")
      ?.replaceChildren(document.createTextNode("Saved on this device"));
    return true;
  } catch {
    storageAvailable = false;
    dirty = true;
    document
      .querySelector("#save-status")
      ?.replaceChildren(
        document.createTextNode("Not saved · Download a backup"),
      );
    notify(
      "Browser storage is full or unavailable. Download your project to keep your work.",
    );
    return false;
  }
}
function scheduleSave() {
  dirty = true;
  document
    .querySelector("#save-status")
    ?.replaceChildren(document.createTextNode("Saving…"));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
function ensureCss() {
  return css
    ? Promise.resolve(css)
    : fetch(new URL("./templates.css", import.meta.url))
        .then((r) => {
          if (!r.ok)
            throw new Error(
              "Preview styles could not be loaded. Please reload.",
            );
          return r.text();
        })
        .then((t) => (css = t));
}
function srcdoc(portfolio, compact = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;padding:0}${css}</style></head><body>${renderPortfolio(portfolio, { compact })}</body></html>`;
}
function header() {
  return `<header class="app-header"><a class="brand" data-action="templates" href="#templates" aria-label="Folio Studio home">${icon("brand")}<span>Folio<span class="brand-light"> Studio</span></span><span class="version">BETA</span></a><nav aria-label="Main navigation"><button data-action="templates" class="nav-link ${view === "templates" ? "active" : ""}">Templates</button><button data-action="editor" class="nav-link ${view === "editor" ? "active" : ""}">My portfolio</button></nav><div class="header-actions"><button data-action="guide" class="button button-quiet">Quick guide</button><a class="github-link" href="https://github.com/nidonghao1-create/folio-studio" target="_blank" rel="noopener noreferrer" aria-label="Folio Studio on GitHub">GitHub <span aria-hidden="true">↗</span></a></div></header>`;
}
function renderGallery() {
  app.innerHTML = `${header()}<main class="catalog"><div class="catalog-heading"><div><p class="eyebrow">A GOOD HOME FOR GOOD WORK</p><h1>Your work.<br><span>In its element.</span></h1><p class="catalog-intro">A portfolio that feels like you. Choose a starting point,<br class="desktop-break"> add your work, and make it your own.</p></div><div class="catalog-note"><span class="note-star" aria-hidden="true">✳</span><p>For designers.<br>For developers.<br>For what comes next.</p><span>OPEN SOURCE · YOUR CONTENT · YOUR WEBSITE</span></div></div><div class="catalog-toolbar"><div class="filter-group" role="group" aria-label="Filter templates">${[
    ["all", "All templates"],
    ["designer", "For designers"],
    ["developer", "For developers"],
  ]
    .map(
      ([id, label]) =>
        `<button class="filter ${filter === id ? "selected" : ""}" data-filter="${id}" aria-pressed="${filter === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><p>Four perspectives. One place for your work.</p></div><div class="template-grid">${TEMPLATES.filter(
    (t) =>
      filter === "all" || String(t.audience).toLowerCase().includes(filter),
  )
    .map(
      (t, i) =>
        `<article class="template-card"><div class="template-art template-art--${t.id}"><div class="mini-frame"><iframe title="${e(t.name)} template sample" tabindex="-1" sandbox="" loading="lazy" data-template-preview="${t.id}"></iframe></div><span class="template-number">0${TEMPLATES.indexOf(t) + 1}</span><button class="preview-pill" data-action="template-preview" data-id="${t.id}">Explore template</button></div><div class="template-info"><div><h2>${e(t.name)}</h2><p>${e(t.description)}</p><span class="template-audience">${e(t.audience).toUpperCase()}</span></div><button class="button button-dark" data-action="use-template" data-id="${t.id}">Use template</button></div></article>`,
    )
    .join(
      "",
    )}</div><div class="catalog-footer"><div><strong>Make it yours. Take it with you.</strong><p>Edit once, try different layouts, and export a complete website.</p></div><span>NO ACCOUNT NEEDED<br>Drafts stay in this browser.</span></div><p class="sample-disclosure">Template previews use fictional sample portfolios. No real clients, results, or endorsements are implied.</p></main><footer class="app-footer"><span>Folio Studio · Made for showing up.</span><span>Open source. Built to be shared.</span></footer>`;
  ensureCss()
    .then(() => {
      document.querySelectorAll("[data-template-preview]").forEach((frame) => {
        const id = frame.dataset.templatePreview;
        const sample = createSample(id === "studio" ? "developer" : "designer");
        sample.template = id;
        frame.srcdoc = srcdoc(sample, true);
      });
    })
    .catch((err) => notify(err.message));
}
function textField(label, field, value, options = {}) {
  const project = options.project ? "data-project-field" : "data-field";
  return `<label class="field"><span>${label}${options.optional ? "<small>Optional</small>" : ""}</span>${options.multiline ? `<textarea ${project}="${field}" rows="${options.rows || 3}" maxlength="${options.max || 2400}" placeholder="${options.placeholder || ""}">${e(value || "")}</textarea>` : `<input ${project}="${field}" type="${options.type || "text"}" value="${e(value || "")}" maxlength="${options.max || 240}" placeholder="${options.placeholder || ""}" ${options.type === "email" ? 'autocomplete="email"' : ""}>`}</label>`;
}
function renderEditor() {
  const project =
    doc.projects.find((p) => p.id === activeProject) || doc.projects[0];
  activeProject = project?.id || "";
  app.innerHTML = `${header()}<main class="editor"><div class="editor-top"><div><p class="eyebrow">YOUR PORTFOLIO</p><h1>Make it feel like you.</h1></div><div class="editor-top-actions"><span id="save-status" class="save-status">${storageAvailable ? (dirty ? "Saving…" : savedAt ? "Saved on this device" : "Local draft") : "Not saved · Download a backup"}</span><button data-action="preview" class="button button-outline">Preview</button><button data-action="export" class="button button-dark">Export website ${icon("download")}</button></div></div><div class="editor-layout"><aside class="editor-panel"><div class="panel-heading"><h2>Edit content</h2><button class="text-button" data-action="tools">Project files</button></div>${doc.sample ? '<div class="sample-banner"><strong>You’re editing a sample.</strong><span>Replace the example work, or start with a blank portfolio.</span><div class="sample-actions"><button class="text-button" data-action="fresh">Start fresh</button><button class="text-button" data-action="own-work">Mark as my work</button></div></div>' : ""}<details class="editor-section" open><summary>01 <span>About you</span></summary><div class="section-content">${textField("Name", "name", doc.name, { max: 80, placeholder: "Your name" })}${textField("Role", "role", doc.role, { max: 120, placeholder: "What you do" })}${textField("Introduction", "tagline", doc.tagline, { multiline: true, rows: 2, max: 240, placeholder: "A short introduction in your own words." })}${textField("About", "bio", doc.bio, { multiline: true, max: 2400, optional: true })}<div class="field-row">${textField("Location", "location", doc.location, { max: 120, optional: true })}${textField("Email", "email", doc.email, { type: "email", max: 254, optional: true })}</div><label class="field"><span>Profession</span><select data-field="profession"><option value="designer" ${doc.profession === "designer" ? "selected" : ""}>Designer</option><option value="developer" ${doc.profession === "developer" ? "selected" : ""}>Developer</option></select></label></div></details><details class="editor-section" open><summary>02 <span>Your work</span><span class="section-count">${doc.projects.length}/12</span></summary><div class="section-content"><div class="project-tabs" role="group" aria-label="Choose a project to edit">${doc.projects.map((p, i) => `<button class="project-tab ${p.id === activeProject ? "selected" : ""}" data-action="select-project" data-id="${e(p.id)}">${String(i + 1).padStart(2, "0")} <span>${e(p.title || "Untitled project")}</span></button>`).join("")}</div><div class="project-add"><button class="button button-outline button-small" data-action="add" ${doc.projects.length >= 12 ? "disabled" : ""}>+ Add project</button><button class="text-button" data-action="github">Import from GitHub</button></div>${project ? `${textField("Project title", "title", project.title, { project: true, max: 120 })}${textField("Category", "category", project.category, { project: true, max: 80, optional: true, placeholder: "e.g. Brand identity, Open-source tool" })}${textField("What is it?", "description", project.description, { project: true, multiline: true, max: 1200, placeholder: "Explain what you made and who it is for." })}<div class="image-upload">${project.image ? `<img src="${e(project.image)}" alt="Current project image"><button class="text-button" data-action="remove-image">Remove image</button>` : '<span class="image-empty" aria-hidden="true">▧</span><p>Add your own screenshot or project image.</p>'}<label class="button button-outline button-small upload-label">${project.image ? "Replace image" : "Upload image"}<input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><small>PNG, JPG or WebP · up to 8 MB. Optimized on this device.</small></div>${textField("Live project URL", "url", project.url, { project: true, type: "url", optional: true, max: 2048, placeholder: "https://your-project.com" })}${textField("Source code URL", "source", project.source, { project: true, type: "url", optional: true, max: 2048, placeholder: "https://github.com/you/project" })}${textField("Tags", "tags", (project.tags || []).join(", "), { project: true, max: 264, optional: true, placeholder: "Design, Research, React" })}<details class="case-fields"><summary>Tell the story behind the work</summary>${textField("Challenge", "challenge", project.challenge, { project: true, multiline: true, optional: true, max: 2400 })}${textField("Your approach", "solution", project.solution, { project: true, multiline: true, optional: true, max: 2400 })}${textField("Outcome", "outcome", project.outcome, { project: true, multiline: true, optional: true, max: 2400 })}</details><div class="project-controls"><div><button class="button button-outline button-small" data-action="move-up" ${doc.projects.indexOf(project) === 0 ? "disabled" : ""} aria-label="Move project earlier">Move up</button><button class="button button-outline button-small" data-action="move-down" ${doc.projects.indexOf(project) === doc.projects.length - 1 ? "disabled" : ""} aria-label="Move project later">Move down</button></div><button class="text-button danger" data-action="delete-project">Remove project</button></div>` : '<p class="empty-state">Add a project to begin. Your work belongs here.</p>'}</div></details><details class="editor-section"><summary>03 <span>Look & feel</span></summary><div class="section-content"><label class="field"><span>Template</span><select data-field="template">${TEMPLATES.map((t) => `<option value="${t.id}" ${doc.template === t.id ? "selected" : ""}>${e(t.name)}</option>`).join("")}</select></label><label class="field color-field"><span>Accent color</span><input type="color" data-field="accent" value="${e(doc.accent)}"><span>${e(doc.accent)}</span></label><label class="toggle-field"><input type="checkbox" data-field="motion" ${doc.motion ? "checked" : ""}><span>Portfolio motion<small>Respects visitors’ reduced-motion preference.</small></span></label><p class="field-help">Changing templates keeps your content. Each layout presents the same work in a different way.</p></div></details><div class="privacy-note">Your draft is saved in this browser. Download a project file to back it up or move it to another device.</div></aside><section class="preview-panel" aria-label="Live website preview"><div class="preview-toolbar"><span><span class="preview-dot" aria-hidden="true"></span>Live preview</span><button class="device-button" data-action="replay-motion">Replay motion</button><div role="group" aria-label="Preview screen size"><button class="device-button ${previewDevice === "desktop" ? "selected" : ""}" data-device="desktop" aria-pressed="${previewDevice === "desktop"}">Desktop</button><button class="device-button ${previewDevice === "mobile" ? "selected" : ""}" data-device="mobile" aria-pressed="${previewDevice === "mobile"}">Mobile</button></div></div><div class="preview-canvas"><div class="preview-browser ${previewDevice === "mobile" ? "is-mobile" : ""}"><div class="browser-chrome"><span>● ● ●</span><span>Your portfolio</span><span>⋯</span></div><iframe id="live-preview" title="Live preview of your portfolio" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe></div></div><p class="preview-caption">This is your actual website. The exported version uses the same layout.</p></section></div></main>`;
  refreshPreview();
}
function refreshPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      await ensureCss();
      const frame = document.querySelector("#live-preview");
      if (frame) frame.srcdoc = srcdoc(doc);
    } catch (err) {
      notify(err.message);
    }
  }, 100);
}
function render() {
  if (view === "templates") renderGallery();
  else renderEditor();
}
function goEditor() {
  view = "editor";
  history.replaceState(null, "", "#editor");
  render();
  window.scrollTo(0, 0);
}
function showDialog(title, body, wide = false) {
  dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="Close dialog">×</button></div>${body}`;
  dialog.className = wide ? "wide-dialog" : "";
  dialog.showModal();
}
function confirmAction(title, message, action, label) {
  showDialog(
    title,
    `<p>${message}</p><div class="dialog-actions"><button class="button button-outline" data-action="close-dialog">Cancel</button><button class="button button-dark" data-action="${action}">${label}</button></div>`,
  );
}
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function emptyPortfolio() {
  return normalizePortfolio({
    version: 1,
    template: doc.template,
    profession: doc.profession,
    name: "",
    role: "",
    tagline: "",
    bio: "",
    email: "",
    location: "",
    github: "",
    accent: doc.accent,
    motion: doc.motion,
    sample: false,
    projects: [],
  });
}
function makeProject() {
  return {
    id: crypto.randomUUID(),
    title: "",
    category: "",
    description: "",
    challenge: "",
    solution: "",
    outcome: "",
    url: "",
    source: "",
    image: "",
    tags: [],
    featured: true,
  };
}
function showGithub() {
  githubResult = null;
  showDialog(
    "Bring in your GitHub projects",
    `<p>Import public repositories, then review their descriptions and links. Private repositories are never requested.</p><form id="github-form"><label class="field"><span>GitHub username</span><input id="github-username" required maxlength="39" placeholder="e.g. octocat" value="${e(doc.github || "")}" autocomplete="off"></label><button class="button button-dark" type="submit">Find projects</button></form><p class="field-help">No token or GitHub login needed. Public API limits apply.</p><div id="github-results" aria-live="polite"></div>`,
  );
}
async function importGithub(event) {
  event.preventDefault();
  githubController?.abort();
  githubController = new AbortController();
  const target = dialog.querySelector("#github-results"),
    button = dialog.querySelector("#github-form button");
  button.disabled = true;
  target.innerHTML = '<p class="loading">Looking up public projects…</p>';
  try {
    const username = dialog.querySelector("#github-username").value.trim();
    const result = await fetchGithubProfile(username, {
      signal: githubController.signal,
    });
    if (!dialog.open) return;
    githubResult = result;
    target.innerHTML = result.repositories.length
      ? `<div class="github-account"><strong>${e(result.user.name || result.user.login)}</strong><span>@${e(result.user.login)}</span></div>${result.truncated ? '<p class="inline-warning">Only the first 1,000 repositories are shown. This account has more projects.</p>' : ""}<p class="field-help">Choose up to ${12 - doc.projects.length} projects. Homepage links are suggestions; check them before publishing.</p><div class="repo-list">${result.repositories.map((r, i) => `<label class="repo-option"><input type="checkbox" name="repository" value="${i}"><span><strong>${e(r.name)}</strong><small>${e(r.description || "No description provided.")}</small><em>${e(r.language || "No language listed")}${r.fork ? " · Fork" : ""}${r.archived ? " · Archived" : ""}</em></span></label>`).join("")}</div><button class="button button-dark" data-action="add-github">Add selected projects</button>`
      : '<p class="empty-state">No public repositories yet. You can still add projects yourself.</p>';
  } catch (err) {
    if (err.name !== "AbortError")
      target.innerHTML = `<p class="inline-error" role="alert">${e(err.message)}</p>`;
  } finally {
    button.disabled = false;
  }
}
async function optimizeImage(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPG or WebP image.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("Please choose an image smaller than 8 MB.");
  const blobUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = blobUrl;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error("This image is too large. Resize it before uploading.");
    const ratio = Math.min(
      1,
      1400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
function setField(target) {
  const field = target.dataset.field || target.dataset.projectField;
  if (!field) return;
  const value = target.type === "checkbox" ? target.checked : target.value;
  if (target.dataset.projectField) {
    const project = doc.projects.find((p) => p.id === activeProject);
    if (!project) return;
    project[field] =
      field === "tags"
        ? value
            .split(",")
            .map((t) => t.trim().slice(0, 32))
            .filter(Boolean)
            .slice(0, 8)
        : value;
    if (field === "title") {
      const tab = document.querySelector(
        `.project-tab[data-id="${CSS.escape(project.id)}"] span`,
      );
      if (tab) tab.textContent = value || "Untitled project";
    }
  } else doc[field] = value;
  if (field === "accent") {
    const span = target.nextElementSibling;
    if (span) span.textContent = value;
  }
  scheduleSave();
  refreshPreview();
}
async function handleAction(action, target) {
  switch (action) {
    case "templates":
      view = "templates";
      history.replaceState(null, "", "#templates");
      render();
      break;
    case "editor":
      goEditor();
      break;
    case "use-template":
      if (!savedAt && !dirty && doc.sample) {
        doc = createSample(
          target.dataset.id === "studio" || filter === "developer"
            ? "developer"
            : "designer",
        );
        activeProject = doc.projects[0]?.id || "";
      }
      doc.template = target.dataset.id;
      scheduleSave();
      goEditor();
      notify("Template applied. Your content is preserved.");
      break;
    case "template-preview": {
      await ensureCss();
      const sample = createSample(
        target.dataset.id === "studio" ? "developer" : "designer",
      );
      sample.template = target.dataset.id;
      const name = TEMPLATES.find((t) => t.id === sample.template).name;
      showDialog(
        name,
        `<div class="template-dialog-preview"><iframe id="explore-preview" title="${e(name)} sample portfolio" sandbox=""></iframe></div><div class="dialog-actions"><button class="button button-outline" data-action="replay-motion" data-id="${sample.template}">Replay motion</button><span class="field-help">Fictional sample · Your content fits this layout.</span><button class="button button-dark" data-action="use-template" data-id="${sample.template}">Use template</button></div>`,
        true,
      );
      dialog.querySelector("iframe").srcdoc = srcdoc(sample);
      break;
    }
    case "replay-motion": {
      const template = target.dataset.id;
      const content = template
        ? {
            ...createSample(template === "studio" ? "developer" : "designer"),
            template,
          }
        : doc;
      const frame = template
        ? dialog.querySelector("#explore-preview")
        : app.querySelector("#live-preview");
      if (frame) frame.srcdoc = srcdoc(content);
      if (
        !content.motion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        notify("Motion is off. Your portfolio remains fully readable.");
      break;
    }
    case "close-dialog":
      githubController?.abort();
      dialog.close();
      break;
    case "guide":
      showDialog(
        "From your work to your website",
        `<ol class="guide-steps"><li><strong>Choose a starting point.</strong><p>Pick a template. You can switch later without losing your content.</p></li><li><strong>Tell your story.</strong><p>Add your projects, images, links and case notes. Samples are fictional; replace them with your own work.</p></li><li><strong>Preview and take it with you.</strong><p>Check desktop and mobile. Export a self-contained index.html and upload it to GitHub Pages or any static host.</p></li></ol><p class="privacy-note">Drafts are local to this browser. Download a project backup to keep an editable copy. Cloud publishing and accounts are not part of this release.</p>`,
      );
      break;
    case "tools":
      showDialog(
        "Your project files",
        `<p>A project file keeps your content, images and template settings editable. It contains only the information you entered.</p>${unrestoredDraft !== null ? '<p class="inline-warning">Your previous saved draft could not be opened. It has been kept intact. Download its original file before starting fresh or importing another project.</p><button class="button button-outline" data-action="download-recovery">Download previous draft</button>' : ""}<div class="file-actions"><button class="button button-dark" data-action="download-project">Download project</button><label class="button button-outline upload-label">Import project<input id="project-import" type="file" accept="application/json,.json" hidden></label></div><p class="field-help">Import replaces this browser’s current draft after confirmation. Keep a backup first.</p><hr><button class="text-button danger" data-action="fresh">Start fresh</button>`,
      );
      break;
    case "download-recovery":
      if (unrestoredDraft !== null) {
        download(
          unrestoredDraft,
          "application/json",
          "previous-draft.folio.json",
        );
        notify(
          "Original draft downloaded. It may need repair or a newer version of Folio Studio.",
        );
      }
      break;
    case "download-project":
      download(
        serializeDraft(doc),
        "application/json",
        projectFilename(doc.name, ".folio.json"),
      );
      notify("Project backup downloaded.");
      break;
    case "own-work":
      confirmAction(
        "Have you replaced the sample content?",
        "Confirm that the projects, descriptions and results are your own work. This removes the sample label from your portfolio.",
        "confirm-own-work",
        "Mark as my work",
      );
      break;
    case "confirm-own-work":
      doc.sample = false;
      scheduleSave();
      dialog.close();
      renderEditor();
      break;
    case "fresh":
      confirmAction(
        "Start with a clean page?",
        "This clears the draft on this device. Download a project backup first if you want to keep it.",
        "confirm-fresh",
        "Start fresh",
      );
      break;
    case "confirm-fresh":
      doc = emptyPortfolio();
      unrestoredDraft = null;
      activeProject = "";
      save();
      dialog.close();
      goEditor();
      notify("Your blank portfolio is ready.");
      break;
    case "select-project":
      activeProject = target.dataset.id;
      renderEditor();
      break;
    case "add":
      if (doc.projects.length >= 12) return;
      const project = makeProject();
      doc.projects.push(project);
      activeProject = project.id;
      scheduleSave();
      renderEditor();
      document.querySelector('[data-project-field="title"]')?.focus();
      break;
    case "delete-project":
      confirmAction(
        "Remove this project?",
        "The project and its image will be removed from this draft. Other projects will stay.",
        "confirm-delete-project",
        "Remove project",
      );
      break;
    case "confirm-delete-project":
      doc = {
        ...doc,
        projects: doc.projects.filter((p) => p.id !== activeProject),
      };
      activeProject = doc.projects[0]?.id || "";
      scheduleSave();
      dialog.close();
      renderEditor();
      break;
    case "move-up":
    case "move-down": {
      const index = doc.projects.findIndex((p) => p.id === activeProject);
      {
        const projects = [...doc.projects];
        const [moving] = projects.splice(index, 1);
        projects.splice(index + (action === "move-up" ? -1 : 1), 0, moving);
        doc = { ...doc, projects };
      }
      scheduleSave();
      renderEditor();
      break;
    }
    case "remove-image":
      doc.projects.find((p) => p.id === activeProject).image = "";
      scheduleSave();
      renderEditor();
      break;
    case "preview":
      await ensureCss();
      showDialog(
        "Your website preview",
        `<p class="field-help">${doc.sample ? "Sample portfolio · Replace fictional content before sharing." : "Review every field and link before publishing your website."}</p><div class="full-preview"><iframe id="full-preview" title="Full website preview" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe></div>`,
        true,
      );
      dialog.querySelector("iframe").srcdoc = srcdoc(doc);
      break;
    case "export": {
      const errors = validatePortfolio(doc);
      if (errors.length) {
        notify(errors[0]);
        return;
      }
      showDialog(
        "Ready to take your website live?",
        `<p>Your website includes your name, contact details, project text, images and links exactly as shown in the preview. Check that you want to make this information public.</p>${doc.sample ? '<p class="inline-warning">This draft still contains sample content. Replace the fictional projects before presenting it as your own work.</p>' : ""}<label class="toggle-field"><input id="public-confirm" type="checkbox"><span>I have reviewed the content and have permission to publish these images.</span></label><div class="dialog-actions"><button class="button button-outline" data-action="close-dialog">Keep editing</button><button class="button button-dark" data-action="confirm-export" disabled>Download website</button></div><p class="field-help">One self-contained index.html. No account, tracking scripts or external dependencies.</p>`,
      );
      break;
    }
    case "confirm-export": {
      await ensureCss();
      const html = exportWebsite(doc, css);
      download(html, "text/html", "index.html");
      save();
      showDialog(
        "Your website is ready",
        `<p><strong>index.html</strong> has been downloaded. Open it in a browser to check your website.</p><ol class="guide-steps"><li>Upload index.html to a GitHub repository.</li><li>Open Settings → Pages and choose the branch containing the file.</li><li>Use the website address GitHub provides to share your work.</li></ol><p class="field-help">You can also use any static host. To edit later, keep a project backup.</p><div class="dialog-actions"><button class="button button-outline" data-action="download-project">Download project backup</button><button class="button button-dark" data-action="close-dialog">Done</button></div>`,
      );
      break;
    }
    case "github":
      showGithub();
      break;
    case "add-github": {
      if (!githubResult) return;
      const selected = [
        ...dialog.querySelectorAll('input[name="repository"]:checked'),
      ].map((el) => githubResult.repositories[Number(el.value)]);
      if (!selected.length) {
        notify("Choose at least one project.");
        return;
      }
      if (doc.projects.length + selected.length > 12) {
        notify(
          `You can add ${12 - doc.projects.length} more projects. Remove sample projects to make room.`,
        );
        return;
      }
      const existing = new Set(doc.projects.map((p) => p.source));
      const projects = selected
        .map(repositoryToProject)
        .filter((p) => !existing.has(p.source));
      doc.projects.push(...projects);
      doc.github = githubResult.user.login;
      activeProject = projects[0]?.id || activeProject;
      scheduleSave();
      dialog.close();
      goEditor();
      notify(
        `${projects.length} project${projects.length === 1 ? "" : "s"} added. Review the links before exporting.`,
      );
      break;
    }
    case "confirm-import": {
      if (!pendingImport) return;
      doc = pendingImport;
      pendingImport = null;
      unrestoredDraft = null;
      activeProject = doc.projects[0]?.id || "";
      const saved = save();
      dialog.close();
      goEditor();
      notify(
        saved
          ? "Project imported and saved on this device."
          : "Project imported into the editor. Download a backup; browser storage is unavailable.",
      );
      break;
    }
  }
  if (action === "use-template" && dialog.open) dialog.close();
}
let pendingImport = null;
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (target) {
    event.preventDefault();
    handleAction(target.dataset.action, target).catch((err) =>
      notify(err.message),
    );
  }
  const f = event.target.closest("[data-filter]");
  if (f) {
    filter = f.dataset.filter;
    renderGallery();
  }
  const d = event.target.closest("[data-device]");
  if (d) {
    previewDevice = d.dataset.device;
    document
      .querySelector(".preview-browser")
      ?.classList.toggle("is-mobile", previewDevice === "mobile");
    document.querySelectorAll("[data-device]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.device === previewDevice);
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.device === previewDevice),
      );
    });
  }
});
document.addEventListener("input", (event) => {
  if (event.target.matches("[data-field],[data-project-field]"))
    setField(event.target);
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.id === "public-confirm") {
    dialog.querySelector('[data-action="confirm-export"]').disabled =
      !target.checked;
    return;
  }
  if (target.id === "image-upload" && target.files[0]) {
    try {
      const image = await optimizeImage(target.files[0]);
      const project = doc.projects.find((p) => p.id === activeProject);
      if (!project) return;
      serializeDraft({
        ...doc,
        projects: doc.projects.map((p) =>
          p.id === activeProject ? { ...p, image } : p,
        ),
      });
      project.image = image;
      scheduleSave();
      renderEditor();
      notify("Image added and optimized.");
    } catch (err) {
      notify(err.message);
    }
    return;
  }
  if (target.id === "project-import" && target.files[0]) {
    try {
      if (target.files[0].size > 8 * 1024 * 1024)
        throw new Error("Project files must be 8 MB or smaller.");
      pendingImport = restoreDraft(await target.files[0].text());
      confirmAction(
        "Replace your current draft?",
        `Import the project for ${e(pendingImport.name || "an unnamed creator")}? This replaces the draft on this device.`,
        "confirm-import",
        "Import project",
      );
    } catch (err) {
      notify(err.message);
    }
    return;
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "github-form") importGithub(event);
});
dialog.addEventListener("close", () => {
  githubController?.abort();
  pendingImport = null;
});
window.addEventListener("pagehide", () => {
  if (dirty) save();
});
window.addEventListener("beforeunload", (event) => {
  if (dirty || !storageAvailable) {
    event.preventDefault();
    event.returnValue = "";
  }
});
if (location.hash === "#editor") view = "editor";
render();
if (unrestoredDraft !== null)
  notify(
    "Your previous draft could not be opened. It is preserved; open Project files to download it.",
  );
