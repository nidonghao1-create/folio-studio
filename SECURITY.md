# Security policy

## Supported versions

Security fixes target the latest 0.1.x version on `main`. The 0.1 line is an early release; see [the test report](docs/TEST_REPORT.md) for the scope of checks actually completed. There is no claim of an independent security audit.

## Report a vulnerability

Do not publish credentials, personal portfolio documents, or working exploit details in a public issue.

If GitHub private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability** or [the private report form](https://github.com/nidonghao1-create/folio-studio/security/advisories/new). If that option is unavailable, open an issue that only asks for a private security contact and does not disclose the vulnerability itself. The maintainer will establish a private channel before requesting details.

A useful private report includes the affected version, browser, a minimal reproduction using fictional data, impact, and any proposed fix. There is no guaranteed response time or bug bounty program.

## Data boundaries

Folio Studio 0.1 is a static editor. It has no server-side user accounts, cloud document storage, AI integration, or GitHub access tokens. The draft lives in browser storage for the current origin. Local storage is not encrypted, and scripts or extensions with access to that origin may read it. Use an editable project download as a backup.

GitHub import requests public data directly from `api.github.com`. It does not verify ownership or continuously synchronize imported data. Exported websites and saved JSON are snapshots; repository privacy changes do not withdraw copies that were already exported or hosted.

Saved documents and website exports may include contact details, project descriptions, and uploaded images. Only put content in them that you intend to keep or publish. Clear the local draft before leaving a shared computer. Deleting the draft does not delete your downloaded files, hosted sites, or third-party copies.

Editable drafts and JSON backups can retain an unfinished or invalid email address or project link as plain text. This prevents losing a field while it is being typed; it does not authorize navigation or publication. The preview validates links independently and omits unsafe or invalid destinations. Website export requires strict content validation and rejects unfinished or unsafe contact/project links.

## Implementation requirements

- Treat project JSON, GitHub responses, and all editable text as untrusted input.
- Use `restoreDraft` / `serializeDraft` from `src/draft.js` for local drafts and editable backups. Validate version, structure, template, field types, project count, lengths, and images; enforce a maximum of 8 MiB for the entire UTF-8 JSON file. Only email and project-link strings may remain unfinished.
- Use the model's strict validation for website export, and validate navigation independently in the renderer. Do not treat a restored draft's raw email or project-link string as a trusted URL.
- Escape creator text in both preview and export; never inject creator HTML, CSS, or scripts.
- Accept external navigation only through validated HTTP/HTTPS URLs. Contact links must use a validated email address.
- Accept image uploads only as validated PNG, JPEG, or WebP data URLs within the editor's size limit; SVG and arbitrary remote image URLs are outside the document format.
- Render previews in a sandboxed iframe without permission to execute scripts.
- Preserve external-link isolation with `noopener` and `noreferrer`.
- Do not add tracking, credentials, a remote dependency, or a new data destination without documenting the behavior.

These are project requirements, not a substitute for checking the current implementation and test evidence. Reviewers should verify editor and standalone export paths independently when changing input or rendering behavior.
