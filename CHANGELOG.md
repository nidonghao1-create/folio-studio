# Changelog

Changes that affect creators, exported websites, and contributors are recorded here.

## Unreleased — template motion

- Distinct motion for all four templates: typography reveals, image unfolding and drift, panel assembly, and spatial exhibit entrances.
- Hover/focus feedback, animated case-study opening and link transitions.
- Replay controls in template exploration and live preview; the existing motion preference applies to exported websites too.
- Native CSS scroll timelines with timed fallback; no added runtime dependency or template script.
- Reduced-motion, touch, keyboard, print and offline-export regression checks, plus actual motion recordings.

See [the motion guide](docs/MOTION.md) for demonstrations and browser limitations. This work is on `feature/template-motion` and is not yet merged into the live Pages editor.

## 0.1.0 — 2026-10-05

Initial local-first release scope:

- An English portfolio editor for designers, developers, and independent makers.
- Four presentations: Editorial, Visual Gallery, Project Studio, and Interactive Room.
- One shared profile and project document, with project case details, ordering, uploaded images, accent color, and a motion preference.
- Local browser drafts, editable JSON download/import, and a self-contained HTML website export.
- Optional anonymous import of public GitHub profiles and repositories, with explicit loading and error states.
- Responsive layouts, semantic project links and case details, and reduced-motion styles.
- Explicitly fictional sample portfolios and original CSS artwork.
- Automated checks, English and Chinese documentation, template contribution guidance, and static GitHub Pages deployment workflows.

### Limits

No cloud account or backup, AI feature, direct site publishing, ownership verification, private repository access, or automatic GitHub synchronization. At most 12 projects per portfolio. GitHub enumeration stops at 10 pages and reports truncation. Browser storage limits can affect saving; project downloads are the portable backup.

The [test report](docs/TEST_REPORT.md) records actual verification. Release scope does not imply that every browser, host, or live API condition has been tested.
