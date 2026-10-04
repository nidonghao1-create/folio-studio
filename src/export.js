import { normalizePortfolio, validatePortfolio, escapeHtml } from "./model.js";
import { renderPortfolio } from "./render.js";
import { LICENSE_TEXT } from "./license.js";
export function exportWebsite(input, css) {
  const errors = validatePortfolio(input);
  if (errors.length) throw new Error(errors[0]);
  const doc = normalizePortfolio(input);
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return `<!doctype html>\n<!-- Folio Studio template code: Copyright 2026 Folio Studio contributors.\nThe creator retains rights to their own content and images.\n${LICENSE_TEXT}\n-->\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(doc.tagline)}"><meta name="theme-color" content="${doc.accent}"><title>${escapeHtml(doc.name)} — ${escapeHtml(doc.role)}</title><style>html,body{margin:0;padding:0}${safeCss}</style></head><body>${renderPortfolio(doc)}</body></html>`;
}
export function projectFilename(name, suffix) {
  return `${
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "my-portfolio"
  }${suffix}`;
}
