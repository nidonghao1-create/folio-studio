# Folio Studio

**Your work, presented your way.** An open-source portfolio editor for designers, developers, and independent makers. Choose a visual direction, tell the story behind your projects, and export a website you can keep.

**Status:** 0.1.0 release candidate. Public GitHub distribution and a hosted studio demo are pending. The source can be run locally using the instructions below.

[简体中文](README.zh-CN.md) · [Demo guide](docs/DEMO.md) · [Contributing](CONTRIBUTING.md) · [Template guide](docs/template-authoring.md) · [Test report](docs/TEST_REPORT.md)

![Folio Studio desktop editor showing a fictional sample portfolio](docs/screenshots/studio-desktop.png)

## What you can make

Four templates share the same editable content, so switching styles does not mean starting over.

| Template             | Best for                                         | Presentation                                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| **Editorial**        | A clear introduction and considered case studies | Strong typography, generous spacing, and a reading-first layout     |
| **Visual Gallery**   | Design and other visual work                     | Image-led project cards with room for the story behind each image   |
| **Project Studio**   | Software, tools, and independent projects        | A compact project overview with direct experience and source links  |
| **Interactive Room** | An expressive personal showcase                  | An architectural exhibit made with CSS and accessible project links |

![The Folio Studio template library with four fictional sample portfolios](docs/screenshots/template-library.png)

Version 0.1 includes an English interface, profile editing, up to 12 projects, project case details, image uploads, project ordering, an accent color, a motion preference, responsive previews, and a self-contained website export. Sample people and projects are **fictional** and labeled as samples. Abstract artwork is decorative artwork, not a screenshot of a real product.

## Make your portfolio

1. Choose **Use template**, then open **Edit content**.
2. Replace the sample profile and projects with your own name, role, story, images, and links. Add each project's challenge, solution, and outcome when helpful.
3. Try another template or accent color. Your content stays with you.
4. Use **Preview** to check the website, including narrow screens and project links.
5. Use **Download project** to keep an editable JSON backup. **Import project** opens a saved document later.
6. Use **Export website** to download a standalone `index.html`. Open it locally or put it on a static host to share your portfolio.

If a saved draft cannot be opened, its original content is preserved. Open **Project files → Download previous draft** before explicitly replacing it with **Start fresh** or an import.

**Local draft** means the draft is stored in this browser on this site's origin. It is not a cloud backup. Download your project before clearing browser data, switching devices, using a different deployment, or replacing the draft. **Start fresh** replaces the current draft; there is no server-side recovery or account history.

An unfinished email address or project link can stay in your local draft and JSON backup so you can finish it later. It is kept as editable text, not trusted navigation: the preview omits invalid links, and website export requires valid contact and project links. JSON import checks document structure, field types and lengths, image format, project count, and file size before replacing the current draft after confirmation.

Uploaded PNG, JPEG, and WebP images are optimized on your device and embedded in the project and exported website. Uploads accept up to 8 MiB before optimization; stored images must be at most 2 MiB each, and JSON backups must not exceed 8 MiB in UTF-8 bytes. Browser storage can run out sooner. Large image files make backups and exports larger; resize them for the web before uploading. There are no remote fonts or asset CDNs in the generated site.

<img src="docs/screenshots/studio-mobile.png" alt="Folio Studio on a narrow screen with a fictional sample portfolio" width="360">

## Optional GitHub import

**Import from GitHub** reads a public profile and public repositories from GitHub's REST API. It requests no login, OAuth scope, password, or personal access token. Review imported descriptions and links before exporting: a repository's homepage is a link supplied by its owner, not proof of a deployed or functioning demo. GitHub metadata does not supply a case study or a project screenshot.

The importer reads owner repositories in pages of up to 100 and stops after 10 pages, reporting truncation when applicable. A portfolio holds at most 12 projects. It handles missing accounts, empty public repository lists, network errors, and request limits without replacing those states with fabricated projects.

Anonymous GitHub API requests are limited to **60 requests per hour per originating IP**; other users behind the same network may share that allowance. GitHub also applies secondary limits. A profile request and every repository page each consume a request. See the official [rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [public repository endpoint](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user), and [pagination guidance](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api).

Import is a snapshot. There is no ownership verification, private repository access, continuous synchronization, or automatic withdrawal when a repository changes visibility. You control what appears in the exported website and must update or remove its hosted copy when needed.

## Run locally

Use **Node.js 22 or newer** and npm.

From the source project's directory:

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). No service account, database, `.env` file, or paid API is required. The browser application has no npm runtime dependencies. Playwright provides development-time browser checks, and Prettier formats the source and documentation.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The build produces `dist/`. The browser suite requires Chromium; on Linux CI use `npx playwright install --with-deps chromium`. See [the test report](docs/TEST_REPORT.md) for actual checks and their results. A configured workflow is not evidence that a deployment or live API test has passed.

## Deploy the editor

Folio Studio is a static browser application. Serve the contents of `dist/` over HTTP or HTTPS; do not open the editor's module source directly through a `file:` URL.

The source includes a [GitHub Pages workflow](.github/workflows/pages.yml). To deploy your own copy on GitHub:

1. Keep a `main` branch and enable GitHub Actions.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy GitHub Pages** from the Actions tab.
4. Check the deployment result and open the URL shown by the `github-pages` environment.

The workflow tests, builds, uploads `dist/`, and deploys it with GitHub's official Pages actions. It needs `pages: write` and `id-token: write` only in the deployment job. GitHub's [custom workflow instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describe the repository setup and supported account plans.

## Deploy your exported portfolio

The downloaded `index.html` includes its styles and uploaded images. Upload that file to any host that serves static HTML, such as your own GitHub Pages repository. A host account or domain is your choice; Folio Studio does not publish on your behalf. The editor does not need to be hosted alongside your portfolio.

Only the exported document is shared. Local drafts and other projects in your browser are not uploaded by this process. Review contact information, screenshots, case details, and external URLs before making the file public. Removing a hosted copy does not erase files someone already downloaded or third-party caches.

## Data and privacy

- Editing and local preview use browser storage. Storage availability and capacity depend on the browser; clearing it removes the local draft.
- GitHub import makes requests to `api.github.com` when you invoke it. Imported public information is editable before export.
- There are no Folio Studio accounts, cloud saving, analytics, AI calls, or server-side publishing in 0.1.
- Saved project JSON and exported HTML can contain your contact details and embedded images. Treat them as your documents and back them up yourself.

When storage is unavailable or full, the editor warns that the draft was not saved and offers a project download. See [SECURITY.md](SECURITY.md) for input boundaries and vulnerability reporting.

## Contribute

Useful contributions include template refinements, accessibility and mobile fixes, reproducible bug reports, and improvements to editing or export. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [template authoring guide](docs/template-authoring.md). Templates in 0.1 are reviewed source contributions; there is no executable theme marketplace or third-party plugin loader.

## License and assets

Copyright 2026 Folio Studio contributors. Code, documentation, fictional samples, and original CSS artwork are licensed under [Apache-2.0](LICENSE). [ASSETS.md](docs/ASSETS.md) lists their origins and the asset contribution requirements.

Your uploaded images, text, imported repository content, and exported portfolio content retain their own ownership and licensing. Using Folio Studio does not grant the project rights to your work or apply Apache-2.0 to it. The generated template code retains its existing license.
