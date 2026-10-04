# Template authoring guide

A Folio Studio template is a presentation of the shared portfolio document. The creator should be able to move from a gallery to a room without losing a project or rewriting content.

Version 0.1 accepts templates as reviewed source contributions. It does not load untrusted JavaScript or arbitrary theme packages at runtime.

## Existing templates

| ID          | Display name     | Intent                                                        |
| ----------- | ---------------- | ------------------------------------------------------------- |
| `editorial` | Editorial        | A reading-first introduction and case studies                 |
| `gallery`   | Visual Gallery   | An image-led showcase with useful project context             |
| `studio`    | Project Studio   | A practical overview of software and independent projects     |
| `room`      | Interactive Room | An architectural exhibit with accessible project entry points |

## Shared document, version 1

Text fields contain plain text. Editable drafts may preserve an unfinished or invalid `email`, project `url`, or `source` as a string; those strings are never trusted navigation. Rendering uses `safeEmail` / `safeUrl`, and website export requires a validated email address and HTTP/HTTPS links. `accent` is a validated six-digit hex color, and `image` is a validated PNG/JPEG/WebP data URL or empty. Images cannot be arbitrary remote URLs or SVG. `github` is a username; recognized GitHub profile URLs are normalized by the model. `version` is a number. `motion`, `featured`, and `sample` are booleans; `projects` and `tags` are arrays. The document holds at most 12 projects.

```json
{
  "version": 1,
  "template": "editorial",
  "profession": "designer",
  "name": "Morgan Sample",
  "role": "Independent designer",
  "tagline": "A fictional portfolio for testing a template.",
  "bio": "Replace this sample profile with your own introduction.",
  "email": "",
  "location": "",
  "github": "",
  "accent": "#5c62d6",
  "motion": false,
  "sample": true,
  "projects": [
    {
      "id": "sample-field-notes",
      "title": "Field Notes — fictional sample",
      "category": "Product design",
      "description": "A fictional project used to evaluate this template.",
      "challenge": "Make a small set of notes easier to browse.",
      "solution": "Group related notes and clarify the reading order.",
      "outcome": "A sample design direction, not a measured product result.",
      "url": "",
      "source": "",
      "image": "",
      "tags": ["Sample", "Design"],
      "featured": true
    }
  ]
}
```

The same document is available as [an importable example](examples/portfolio.json). `sample: true` means it must remain labeled as fictional. Do not add invented usage numbers or links to unrelated products to make a sample look real.

The authoritative content validation and limits live in `src/model.js`; the application draft and backup boundary lives in `src/draft.js`. Use `restoreDraft(text)` for local storage and editable JSON backup imports, and `serializeDraft(doc)` for saving and downloading backups. These share the same reader, preserve only the unfinished email/project-link strings, and still enforce the document structure, all other field validation, and image restrictions. Backups must not exceed 8 MiB in UTF-8 bytes, including formatting. Stored images are limited to 2 MiB each. Tags are limited to eight per project and 32 characters per tag.

`normalizePortfolio` requires any non-empty email or link to be valid; `validatePortfolio` additionally checks that the content is complete enough to export a website. `parseImport` is a strict content helper; it rejects invalid email or links and is not the application's editable-backup reader. Do not normalize an unfinished draft through that path simply to save it. The renderer must independently validate navigation and escape text, including when it receives a restored unfinished draft. Do not maintain a competing schema inside a template. A new document version needs an explicit migration policy and compatibility tests.

## Add a template

1. Describe the creator and projects the template serves, including a narrow-screen sketch.
2. Add a stable template ID and metadata to `TEMPLATES` in `src/model.js`; update allowed-template validation and tests. Keep `{ id, name, audience, description }` metadata concise and English.
3. Add semantic markup in `src/render.js` only when existing markup cannot serve the presentation. Escape plain text and use the shared URL/email validation. Keep case content and link labels readable.
4. Add namespaced styles in `src/templates.css`. Use the existing accent variable and content structure. The preview and standalone export use the same renderer and styles.
5. Add a picker preview and exercise the new template in automated and visual checks.
6. Document any new assets in [ASSETS.md](ASSETS.md), and include screenshots with fictional or consented content in the pull request.

An illustrative metadata entry for a proposed template:

```js
{
  id: 'journal',
  name: 'Project Journal',
  audience: 'Writers and makers',
  description: 'A chronological presentation of project stories.'
}
```

`journal` is a documentation example, not a shipped template or an accepted version-1 document value. Adding metadata alone does not make a template available.

## Presentation requirements

- Make each project's title, description, case details, and valid action links easy to find.
- Work at 375px width without horizontal content overflow. Support touch without hover-only information.
- Provide semantic headings, meaningful link text, visible focus, and keyboard access to every project.
- Respect the creator's `motion` preference and the system's `prefers-reduced-motion` setting. Content must remain understandable without animation.
- Give images useful alt text and a stable layout. Empty images can use original abstract art; do not fabricate screenshots.
- Retain clear sample labels and distinguish actual creator content from decorative art.
- Use no remote font, CDN dependency, script execution, or network call in template rendering.
- Keep exported HTML self-contained and print-friendly. Make external links use `noopener noreferrer`. Preserve the template code's license copy and applicable copyright/attribution notices in the exported artifact without relicensing the creator's content.
- Keep preview scripts disabled. A template cannot relax the editor iframe's sandbox.
- Support long names, empty optional fields, one project, and the maximum project count.

## Acceptance checklist

- [ ] Template switching preserves every supported content field and project order.
- [ ] Saved JSON round-trips through `serializeDraft` and `restoreDraft`, including unfinished email and project links.
- [ ] Rendering omits unsafe navigation from a restored draft; website export rejects unfinished or unsafe contact/project links.
- [ ] Desktop and 375px layouts were reviewed and screens attached.
- [ ] Keyboard navigation, case details, links, focus, and reduced motion were checked.
- [ ] The exported `index.html` works with network access disabled, apart from deliberate external link navigation.
- [ ] Special characters and malicious text/URL fixtures cannot inject markup or scripts.
- [ ] Unit tests, build, and relevant browser tests pass; skipped checks are stated.
- [ ] Assets, licensing, user-facing documentation, and release notes are updated.
