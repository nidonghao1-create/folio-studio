// Portfolio content stays data. Rendering is responsible for escaping all text.
export const TEMPLATES = Object.freeze(
  [
    {
      id: "editorial",
      name: "Editorial",
      audience: "Designers & developers",
      description: "A considered, type-led portfolio with room for your story.",
    },
    {
      id: "gallery",
      name: "Visual Gallery",
      audience: "Designers",
      description: "A spacious visual collection for image-led work.",
    },
    {
      id: "studio",
      name: "Project Studio",
      audience: "Developers",
      description:
        "Clear project stories, technical context, and useful links.",
    },
    {
      id: "room",
      name: "Interactive Room",
      audience: "Designers & developers",
      description: "An architectural exhibit of your selected projects.",
    },
  ].map(Object.freeze),
);

const LIMITS = {
  name: 80,
  role: 120,
  tagline: 240,
  bio: 2400,
  location: 120,
  github: 200,
  email: 254,
  title: 120,
  category: 80,
  description: 1200,
  challenge: 2400,
  solution: 2400,
  outcome: 2400,
  url: 2048,
  source: 2048,
};
const MAX_PROJECTS = 12;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_CHARS = 8 * 1024 * 1024;
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

export function safeUrl(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (
    !text ||
    text.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(text) ||
    !/^https?:\/\//i.test(text)
  )
    return "";
  try {
    const url = new URL(text);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}

export function safeEmail(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > 254 || /[\s\u0000-\u001f\u007f]/.test(text)) return "";
  // This deliberate subset prevents mailto query/header injection.
  return /^[a-z\d.!#$'*+\-^_`{|}~]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(
    text,
  )
    ? text
    : "";
}

function textField(value, key, label, errors) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    errors.push(`${label} must be text.`);
    return "";
  }
  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (text.length > LIMITS[key])
    errors.push(`${label} must be ${LIMITS[key]} characters or fewer.`);
  return text;
}

function urlField(value, key, label, errors) {
  const text = textField(value, key, label, errors);
  const url = safeUrl(text);
  if (text && !url)
    errors.push(
      `${label} must be a full http:// or https:// URL without credentials.`,
    );
  return url;
}

function githubField(value, errors) {
  let text = textField(value, "github", "GitHub username", errors);
  if (!text) return "";
  if (/^https:\/\/github\.com\//i.test(text)) {
    try {
      const url = new URL(text);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/[\w-]+\/?$/.test(url.pathname)
      )
        throw new Error();
      text = url.pathname.replace(/^\/|\/$/g, "");
    } catch {
      errors.push("GitHub must be a username or a GitHub profile URL.");
      return "";
    }
  }
  if (!USERNAME.test(text)) {
    errors.push(
      "GitHub usernames use 1–39 letters, numbers, and single hyphens.",
    );
    return "";
  }
  return text;
}

function imageField(value, label, errors) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    errors.push(`${label} must be an uploaded PNG, JPEG, or WebP image.`);
    return "";
  }
  if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) {
    errors.push(`${label} must be 2 MB or smaller. Upload a smaller image.`);
    return "";
  }
  const match =
    /^data:image\/(png|jpeg|webp);base64,((?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?)$/.exec(
      value,
    );
  if (!match || !match[2]) {
    errors.push(
      `${label} must be an uploaded PNG, JPEG, or WebP image; remote images and SVG are not supported.`,
    );
    return "";
  }
  const payload = match[2];
  const bytes =
    (payload.length * 3) / 4 -
    (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) {
    errors.push(`${label} must be 2 MB or smaller.`);
    return "";
  }
  try {
    const header = atob(payload.slice(0, 64));
    const signatureMatches =
      match[1] === "png"
        ? bytes >= 24 &&
          header.startsWith("\x89PNG\r\n\x1a\n") &&
          header.slice(12, 16) === "IHDR"
        : match[1] === "jpeg"
          ? bytes >= 4 && header.startsWith("\xff\xd8\xff")
          : bytes >= 20 &&
            header.startsWith("RIFF") &&
            header.slice(8, 12) === "WEBP" &&
            /^VP8[ LX]$/.test(header.slice(12, 16));
    if (!signatureMatches) throw new Error();
  } catch {
    errors.push(
      `${label} does not match its image format. Upload a valid PNG, JPEG, or WebP.`,
    );
    return "";
  }
  return value;
}

function projectRecord(input, index, errors) {
  const label = `Project ${index + 1}`;
  if (!isRecord(input)) {
    errors.push(`${label} must be an object.`);
    input = {};
  }
  let id = input.id ?? `project-${index + 1}`;
  if (typeof id !== "string" || !/^[a-z\d][a-z\d_-]{0,99}$/i.test(id)) {
    errors.push(`${label} has an invalid ID.`);
    id = `project-${index + 1}`;
  }
  const result = { id };
  for (const key of [
    "title",
    "category",
    "description",
    "challenge",
    "solution",
    "outcome",
  ]) {
    result[key] = textField(input[key], key, `${label} ${key}`, errors);
  }
  result.url = urlField(input.url, "url", `${label} project link`, errors);
  result.source = urlField(
    input.source,
    "source",
    `${label} source link`,
    errors,
  );
  result.image = imageField(input.image, `${label} image`, errors);
  result.tags = [];
  if (input.tags !== undefined && !Array.isArray(input.tags))
    errors.push(`${label} tags must be a list.`);
  else if (Array.isArray(input.tags)) {
    if (input.tags.length > 8) errors.push(`${label} can have up to 8 tags.`);
    for (const tag of input.tags) {
      if (typeof tag !== "string") {
        errors.push(`${label} tags must be text.`);
        continue;
      }
      const clean = tag.trim().replace(/[\u0000-\u001f\u007f]/g, "");
      if (clean.length > 32)
        errors.push(`${label} tags must be 32 characters or fewer.`);
      if (clean && !result.tags.includes(clean)) result.tags.push(clean);
    }
  }
  if (input.featured !== undefined && typeof input.featured !== "boolean")
    errors.push(`${label} featured must be true or false.`);
  result.featured = input.featured ?? true;
  return result;
}

function inspect(input) {
  const errors = [];
  if (!isRecord(input))
    return { errors: ["Your portfolio must be a JSON object."], doc: null };
  if (input.version !== undefined && input.version !== 1)
    errors.push(
      "This portfolio version is not supported. Use a version 1 document.",
    );
  const doc = { version: 1 };
  if (
    input.template !== undefined &&
    !TEMPLATES.some(({ id }) => id === input.template)
  )
    errors.push("Choose one of the four available templates.");
  doc.template = input.template ?? "editorial";
  if (
    input.profession !== undefined &&
    !["designer", "developer"].includes(input.profession)
  )
    errors.push("Profession must be designer or developer.");
  doc.profession = input.profession ?? "designer";
  for (const key of ["name", "role", "tagline", "bio", "location"])
    doc[key] = textField(
      input[key],
      key,
      key[0].toUpperCase() + key.slice(1),
      errors,
    );
  const email = textField(input.email, "email", "Email", errors);
  doc.email = safeEmail(email);
  if (email && !doc.email)
    errors.push(
      "Enter a valid email address without extra headers or parameters.",
    );
  doc.github = githubField(input.github, errors);
  const accent = input.accent ?? "#c45d3a";
  if (typeof accent !== "string" || !/^#[a-f\d]{6}$/i.test(accent))
    errors.push("Accent must be a six-digit hex color, such as #c45d3a.");
  doc.accent =
    typeof accent === "string" && /^#[a-f\d]{6}$/i.test(accent)
      ? accent.toLowerCase()
      : "#c45d3a";
  for (const key of ["motion", "sample"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean")
      errors.push(
        `${key === "motion" ? "Motion" : "Sample status"} must be true or false.`,
      );
    doc[key] = input[key] ?? key === "motion";
  }
  if (input.projects !== undefined && !Array.isArray(input.projects))
    errors.push("Projects must be a list.");
  const projects = Array.isArray(input.projects) ? input.projects : [];
  if (projects.length > MAX_PROJECTS)
    errors.push(
      "A portfolio can contain up to 12 projects. Remove some before importing.",
    );
  doc.projects = projects
    .slice(0, MAX_PROJECTS)
    .map((project, index) => projectRecord(project, index, errors));
  const ids = new Set();
  for (const project of doc.projects) {
    if (ids.has(project.id)) errors.push("Each project must have a unique ID.");
    ids.add(project.id);
  }
  if (JSON.stringify(doc).length > MAX_IMPORT_CHARS - 16384)
    errors.push(
      "This portfolio is too large for a restorable backup. Use smaller project images.",
    );
  return { doc, errors: [...new Set(errors)] };
}

export function normalizePortfolio(input) {
  const { doc, errors } = inspect(input);
  if (errors.length) throw new Error(errors.join(" "));
  return doc;
}

export function validatePortfolio(input) {
  const { doc, errors } = inspect(input);
  if (!doc) return errors;
  if (!doc.name) errors.push("Add your name before exporting.");
  if (!doc.projects.length)
    errors.push("Add at least one project before exporting.");
  doc.projects.forEach((project, index) => {
    if (!project.title) errors.push(`Add a title for project ${index + 1}.`);
  });
  return [...new Set(errors)];
}

export function parseImport(text) {
  if (typeof text !== "string")
    throw new Error("Choose a portfolio JSON file.");
  if (text.length > MAX_IMPORT_CHARS)
    throw new Error(
      "This file is too large. Portfolio backups must be 8 MB or smaller.",
    );
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a Folio Studio portfolio backup.",
    );
  }
  if (
    !isRecord(input) ||
    input.version !== 1 ||
    !Array.isArray(input.projects)
  ) {
    throw new Error("This is not a version 1 Folio Studio portfolio backup.");
  }
  return normalizePortfolio(input);
}

export function reorderProjects(doc, from, to) {
  const result = normalizePortfolio(doc);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= result.projects.length ||
    to >= result.projects.length
  ) {
    throw new Error("Choose a valid project position.");
  }
  const [project] = result.projects.splice(from, 1);
  result.projects.splice(to, 0, project);
  return result;
}

export function withProject(doc, project) {
  const result = normalizePortfolio(doc);
  if (!isRecord(project)) throw new Error("The project must be an object.");
  const id =
    project.id ||
    `project-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const index = result.projects.findIndex((item) => item.id === id);
  if (index >= 0)
    result.projects[index] = { ...result.projects[index], ...project, id };
  else result.projects.push({ ...project, id });
  return normalizePortfolio(result);
}

export function removeProject(doc, id) {
  const result = normalizePortfolio(doc);
  result.projects = result.projects.filter((project) => project.id !== id);
  return result;
}

export function createSample(profession = "designer") {
  if (!["designer", "developer"].includes(profession))
    throw new Error("Choose designer or developer.");
  const designer = profession === "designer";
  const projects = designer
    ? [
        {
          title: "Still / A reading journal",
          category: "Product design",
          description:
            "A fictional concept for a quieter place to collect reading notes.",
          challenge:
            "Fictional brief: help a reader return to ideas without a distracting feed.",
          solution:
            "An editorial reading log with a clear hierarchy and a calm note-taking flow.",
          outcome:
            "Sample concept only. No real launch, client, research result, or usage metric is claimed.",
          tags: ["Product", "Interaction", "Concept"],
        },
        {
          title: "Fieldwork / Identity system",
          category: "Brand & identity",
          description:
            "A fictional identity study for an imagined independent design collective.",
          challenge:
            "Fictional brief: make a flexible identity that works across a website and printed material.",
          solution:
            "A typographic system, earthy palette, and modular compositions.",
          outcome:
            "Sample case study, with no real client endorsement or commercial outcome.",
          tags: ["Brand", "Typography", "Concept"],
        },
        {
          title: "Common Ground / Exhibition",
          category: "Spatial design",
          description:
            "An imagined digital exhibition that makes a small collection easy to explore.",
          challenge:
            "Fictional brief: provide a visual overview without obscuring each work’s story.",
          solution:
            "An architectural arrangement paired with accessible, structured project details.",
          outcome:
            "Fictional exhibition concept. The artwork is an original abstract placeholder, not a project screenshot.",
          tags: ["Space", "Web", "Concept"],
        },
      ]
    : [
        {
          title: "Pocket Atlas",
          category: "Web application",
          description:
            "A fictional project concept for saving personal places in an offline-friendly notebook.",
          challenge:
            "Fictional brief: make saved places usable when connectivity is unreliable.",
          solution:
            "A proposed local-first interface with clear sync states and keyboard-friendly navigation.",
          outcome:
            "Sample project only. No working application, repository, benchmarks, or users are claimed.",
          tags: ["Local-first", "JavaScript", "Concept"],
        },
        {
          title: "Quiet Notes",
          category: "Developer tool",
          description:
            "An imagined small tool for collecting useful notes alongside personal projects.",
          challenge:
            "Fictional brief: keep project context findable without adding a complex workflow.",
          solution:
            "A proposed searchable note index with plain-text import and export.",
          outcome:
            "Fictional case study, without a real release or performance measurements.",
          tags: ["Tools", "Search", "Concept"],
        },
        {
          title: "Tiny Garden",
          category: "Creative coding",
          description:
            "A fictional interactive study in small browser-based generative landscapes.",
          challenge:
            "Fictional brief: create a playful experience that also respects reduced motion.",
          solution:
            "A proposed seed-based scene with a static alternative and simple controls.",
          outcome:
            "Sample concept only. The abstract preview is original placeholder artwork, not a real application screenshot.",
          tags: ["Creative coding", "Accessibility", "Concept"],
        },
      ];
  return normalizePortfolio({
    version: 1,
    template: designer ? "editorial" : "studio",
    profession,
    name: designer ? "Avery Morgan" : "Rowan Ellis",
    role: designer
      ? "Independent designer · Fictional sample"
      : "Creative developer · Fictional sample",
    tagline: designer
      ? "Thoughtful identities and digital experiences."
      : "Small tools. Clear ideas. Useful experiences.",
    bio: "This is a fictional sample profile created to demonstrate Folio Studio. All projects are invented examples. Replace this content with your own work before publishing.",
    email: "",
    location: "",
    github: "",
    accent: designer ? "#c45d3a" : "#406754",
    motion: true,
    sample: true,
    projects: projects.map((project, index) => ({
      ...project,
      id: `sample-${profession}-${index + 1}`,
      url: "",
      source: "",
      image: "",
      featured: true,
    })),
  });
}
