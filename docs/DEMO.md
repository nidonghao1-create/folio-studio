# Release demonstration

These are screenshots of the running application and exports produced by its actual renderer. All profiles and project stories in these materials are fictional and labeled as samples. Abstract CSS artwork is not a product screenshot.

![The four-template library](screenshots/template-library.png)

## Try the complete flow

1. Run the app using the [README instructions](../README.md#run-locally).
2. Select **Project Studio**, then **Use template**. Choose **Start fresh** if you want a blank document.
3. Add your name and a project, or use **Import from GitHub** with a real public GitHub username. Review a repository's description, source link, and any homepage suggestion before adding it.
4. Add an image and case details. Switch templates in **Look & feel** and confirm the content remains intact.
5. Use **Preview** and the **Mobile** preview control. Open case details and check each project link.
6. Download a project backup. Export the website after reviewing its public content.
7. Open the downloaded `index.html` locally. Upload it to your own static host to share the website.
8. Reimport the project backup to edit it later.

Direct hosting is a manual step in 0.1. There is no connected account, automatic publishing, analytics, or AI generation.

## Sample website exports

Download these HTML files and open them in a browser. They are self-contained and work offline; sample projects deliberately have no invented demo or source links.

- [Editorial](demos/editorial.html)
- [Visual Gallery](demos/gallery.html)
- [Project Studio](demos/studio.html)
- [Interactive Room](demos/room.html)

## Reproduce the screenshots

With the app running at `http://127.0.0.1:4173`, run:

```sh
npx playwright install chromium
node scripts/capture-demo.mjs
```

The script uses an isolated browser context with no personal browser data. `FOLIO_BASE_URL` can point at another local build; `FOLIO_BROWSER` can select an installed Chromium-compatible executable. It creates seven screenshots and four labeled exports. Asset origins are recorded in [ASSETS.md](ASSETS.md).
