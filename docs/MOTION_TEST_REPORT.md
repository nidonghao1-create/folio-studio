# Template motion verification

Verified on **2026-10-06 (Asia/Shanghai)** on `feature/template-motion`. These are executed local checks, separate from the historical 0.1.0 release report.

| Check                                       | Result                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Node unit suite                             | 53 passed; no failures or skips                                  |
| Built editor/browser regression suite       | 22 passed, including sandboxed replay and content preservation   |
| Draft/recovery regression suite             | 11 passed                                                        |
| Dedicated motion suite                      | 23 passed                                                        |
| Source/document formatting and static build | Passed                                                           |
| Actual exported-template recordings         | Four GIFs captured from the branch's renderer                    |
| Desktop and touch screenshots               | Eight captured by motion checks; representative layouts reviewed |

Environment: macOS on Apple Silicon, Node.js 24.19.0, Playwright 1.62.1, Chrome **154.0.8037.98**. Browsers ran with fresh temporary profiles; no personal browser storage, cookies or credentials were used. Dependencies were already installed. No new runtime packages or remote assets were added.

## Exercised behavior

- All four exports start their headline animation, finish in a readable resting state, and expose one complete accessible heading.
- Project chapters arrive while scrolling. Keyboard controls open case notes; Room objects lead to the matching project record. Focused cards and deep-link targets bypass scroll arrival.
- System reduced motion and the creator's `motion: false` each disable every template animation and transition. The same checks cover the complete descendant tree, rather than only the app's outer buttons.
- Print output has no active animation and keeps project content visible.
- Removing the native view-timeline enhancement exercises the timed fallback. Every project returns to its visible state.
- 240-character unbroken headings fit at 375px. All templates support touch case-study activation at 390px with page JavaScript disabled.
- Gallery artwork reacts to hover and returns to rest.
- Export checks record no network requests or uncaught browser errors.
- Replay works in all four template exploration iframes and in the live editor. The existing iframe sandbox stays intact and creator content survives replay with motion disabled.
- The existing editor suite still checks editing, persistence, uploads, template switching, project ordering, backup/import, export confirmation, GitHub error states and mobile layout. The independent draft suite checks unfinished inputs, quota errors and recovery.

## Limits

Only the installed Chrome browser was executed in this round. Touch is browser emulation, not a physical phone. The fallback was tested by removing the feature-gated CSS layer; this is not a claim of a native Safari or Firefox test. Native view-timeline support varies by browser. Those browsers retain the timed entrance and interaction layer.

No measured frame-rate, GPU-memory or low-end-device benchmark is claimed. The implementation uses bounded transform/opacity/clip-path animations, no infinite loops or scroll handlers, and adds approximately **1,756 gzip bytes** to `templates.css` versus `main` (7,923 → 9,679 bytes). Clip-path and shadows can still incur rendering cost depending on browser and device.

The Pages editor follows `main`; this branch has not been merged or deployed to that public URL. Previous red runs remain in GitHub history even after the successful 0.1.0 deployment.

## Reproduce

```sh
npm test
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` includes the dedicated motion suite. Browser tests write their machine-readable reports and screenshots to ignored `test-results/`. On a development machine, `FOLIO_BROWSER` can select an installed Chrome executable for an isolated test profile. See [the motion guide](MOTION.md) for real demonstrations and intended fallback behavior.
