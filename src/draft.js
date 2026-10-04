import { normalizePortfolio } from "./model.js";

const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function checkSize(text) {
  if (typeof text !== "string")
    throw new Error("Choose a Folio Studio project JSON file.");
  if (
    text.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES
  ) {
    throw new Error(
      "Project files must be 8 MB or smaller. Use smaller project images.",
    );
  }
}

function unfinishedText(value, max, label) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return value;
}

/** Restore editable data, including a URL or email that is still being typed.
 * These raw strings are never trusted links: rendering and website export keep
 * their separate URL/email validation boundaries.
 */
export function restoreDraft(text) {
  checkSize(text);
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a Folio Studio project backup.",
    );
  }
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.projects)) {
    throw new Error("This is not a version 1 Folio Studio project backup.");
  }
  if (raw.projects.length > 12)
    throw new Error("A portfolio can contain up to 12 projects.");
  const email = unfinishedText(raw.email, 254, "Email");
  const links = raw.projects.map((project, index) => {
    if (!isRecord(project))
      throw new Error(`Project ${index + 1} must be an object.`);
    return {
      url: unfinishedText(
        project.url,
        2048,
        `Project ${index + 1} project link`,
      ),
      source: unfinishedText(
        project.source,
        2048,
        `Project ${index + 1} source link`,
      ),
    };
  });
  const doc = normalizePortfolio({
    ...raw,
    email: "",
    projects: raw.projects.map((project) => ({
      ...project,
      url: "",
      source: "",
    })),
  });
  doc.email = email;
  doc.projects.forEach((project, index) =>
    Object.assign(project, links[index]),
  );
  return doc;
}

/** A downloadable project file must be readable by the same draft importer. */
export function serializeDraft(input) {
  const doc = restoreDraft(JSON.stringify(input));
  const text = JSON.stringify(doc, null, 2);
  checkSize(text);
  return text;
}
