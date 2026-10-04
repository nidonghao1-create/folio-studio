# Release candidate verification

Verified on **2026-10-05 (Asia/Shanghai)** for Folio Studio 0.1.0. This report describes actual local results, not inferred results from configured workflows.

## Environment and outcome

| Check                                                   | Result                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Clean dependency installation from `package-lock.json`  | Passed with npm 12.2.0                                                         |
| Prettier source/document formatting                     | Passed                                                                         |
| Node unit tests                                         | **53 passed, 0 failed, 0 skipped**                                             |
| Main browser suite against the built `dist/` website    | **21 passed**                                                                  |
| Independent draft/recovery browser suite against source | **11 passed**                                                                  |
| Static build                                            | Passed                                                                         |
| Real public GitHub API smoke test                       | `octocat`: 8 owner repositories, no truncation                                 |
| Release screenshots and standalone demonstrations       | Seven real screenshots and four sample exports generated and visually reviewed |
| Public repository, GitHub Actions and Pages deployment  | Pending GitHub authentication; not verified                                    |

Local environment: macOS 27.0.1 on Apple Silicon, Node.js 24.19.0, Chrome 154.0.8037.93, Playwright 1.62.1. Chrome ran headlessly in isolated temporary profiles. No personal browser data was used. The npm 12 installation blocked the optional macOS `fsevents` install script; installation, build and all checks still passed. Linux CI uses its own npm and installed Playwright Chromium; that run remains pending.

## What was exercised

Unit checks cover document types and sizes, URLs and email, malicious text, image formats, project count, duplicate IDs, sample disclosure, shared content across four templates, exact license preservation, standalone export, safe filenames, unfinished-draft backup round trips, and GitHub pagination, malformed data, rate limits, cancellation and failures.

The main browser suite covers the four-template catalog and profession filters, modal Escape, first use on a simulated touch device, home navigation, editing and reload, unfinished-link preservation, image optimization, template switching, project ordering/deletion, sample ownership confirmation, backup/restore, invalid imports, public-export confirmation and actual HTML downloads. GitHub browser integration uses explicitly controlled API fixtures for success, missing account and rate-limit cases. User text stays inert. All four exports fit 375, 680 and 1280px widths, their case details open, reduced motion disables transitions, and the observed page has no uncaught runtime errors.

The independent browser suite additionally checks unfinished email/source links, image upload during incomplete editing, portable backup reimport, unsafe links remaining inactive, strict export refusal, quota failure without overwriting a previous save, emergency download, successful save retry, intact recovery of an unreadable local draft, and explicit replacement confirmation.

The live API smoke test invoked the actual `fetchGithubProfile('octocat')` importer at `2026-10-04T17:08:05.168Z`. It used no credential and returned eight repositories. This verifies live transport and response handling at that moment; it does not verify anyone's project homepage or prove an online demo works. API rules are documented by [GitHub](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Reproduce

```sh
npm ci
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium`. The main suite starts a local server for `dist/` if needed. The draft suite starts its own source server on port 4185. Use unused ports or set `FOLIO_BASE_URL` together with `PORT`, and `FOLIO_DRAFT_PORT`. `FOLIO_BROWSER` can select an installed Chromium-compatible executable.

Machine-readable browser results are in [verification.json](verification.json). Subsequent local runs write their own reports to ignored `test-results/`. Screenshot reproduction is explained in [DEMO.md](DEMO.md).

## Limits of this verification

Firefox, Safari/WebKit, physical phones, screen-reader operation, a full accessibility audit, and measured low-end hardware performance were not tested. Touch and reduced-motion behavior were simulated in Chrome. Responsive width checks do not establish compatibility with every device. Network/offline, limit and malicious-input cases are controlled automated fixtures, except for the separately identified live API request. Public hosting and visitor sharing need verification after repository publication.

Cloud saving, direct publication, AI generation, authenticated/private GitHub access, ownership checks and continuous sync are outside this release. Sample content is fictional; no client, usage statistic or real project screenshot is implied.
