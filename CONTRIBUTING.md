# Contributing to Folio Studio

Folio Studio helps creators present real work. Contributions should make editing, understanding projects, or sharing a useful portfolio easier. The public interface is English; documentation translations are welcome.

## Before you start

For a bug, include reproducible steps, the template, browser/version, screen size, and the expected and actual result. Use fictional or redacted content in reproduction files. For a new feature or template, open an issue describing the user problem and an example of the intended experience before making a large change.

Please keep discussion respectful and concrete. Do not post another person's private content, credentials, or security exploit details in public issues. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Development

Requirements: Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

The local editor is available at `http://127.0.0.1:4173`.

```sh
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For Linux machines missing browser libraries, use `npx playwright install --with-deps chromium`. Browser tests and screenshots should use the Playwright version pinned in `package-lock.json`.

Run `npm run format` before submitting changes. Prettier keeps source, styles, and documentation consistent. Generated exports and the embedded license are excluded from formatting.

## Project boundaries

- `src/model.js`: document validation, normalization, safe URLs, and content changes.
- `src/draft.js`: editable draft and backup validation, including unfinished links.
- `src/render.js`: shared semantic portfolio markup for preview and export.
- `src/templates.css`: responsive template styles and original abstract artwork.
- `src/github.js`: optional anonymous public GitHub import.
- `scripts/`: local server and static build.
- `tests/`: model, import, export, and browser checks.
- `docs/`: template guidance, asset origins, screenshots, and actual test evidence.

Preserve a single content model across templates. Exported websites must remain self-contained. The app must remain usable without a GitHub request or service credentials. Keep sample profiles and projects explicitly fictional. No feature should invent a real project screenshot, activity statistic, or working demo link.

## Pull request checklist

- Explain the concrete user problem and the resulting behavior.
- Keep changes focused; mention any document version or import compatibility changes.
- Run the relevant tests and build. State which checks were run and which were not.
- Verify desktop and 375px layouts when changing UI or templates.
- Check keyboard access, visible focus, readable contrast, and reduced motion.
- Check the standalone export as well as the editor preview.
- Preserve editable content when switching templates or importing a valid saved document.
- Add asset origin, author, and license information to [ASSETS.md](docs/ASSETS.md) when adding visual resources.
- Attach screenshots with fictional or consented content when the presentation changes.
- Update English and Chinese documentation when public behavior changes.

Template contributions have additional requirements in the [template authoring guide](docs/template-authoring.md).

## Licensing

Unless you explicitly state otherwise, contributions intentionally submitted for inclusion are offered under the repository's [Apache-2.0 license](LICENSE). Only submit code and assets you have the right to contribute. Existing third-party license and attribution requirements must be preserved. User-created portfolio content is not automatically covered by the project's license.
