# Asset origins and licensing

This manifest covers visual resources included in the repository and generated template presentation. It does not claim rights over a creator's uploaded images, imported repository content, or exported portfolio content.

| Resource                                                                            | Origin / author                                                                                                                        | License and attribution                                                                                                  |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Template layouts, gradients, abstract artwork, room architecture, and UI decoration | Original Folio Studio project contributions, implemented in HTML/CSS                                                                   | Apache-2.0; preserve repository license and applicable notices when redistributing code                                  |
| Fictional sample names, biographies, case text, and project labels                  | Original Folio Studio project contributions                                                                                            | Apache-2.0; clearly identify them as fictional samples                                                                   |
| `docs/screenshots/*.png` and `docs/demos/*.html`                                    | Seven screenshots and four standalone sample exports captured from the running Folio Studio application using fictional sample content | Apache-2.0 for template code and original sample content; record material changes when modifying these repository assets |
| Typography                                                                          | Browser/system font stacks; no font file is bundled or downloaded                                                                      | Installed fonts remain subject to their respective licenses; no font redistribution is involved                          |
| Creator-uploaded PNG/JPEG/WebP images                                               | Supplied by the creator, stored as embedded image data in their document                                                               | The creator's original rights and any third-party terms apply; uploading does not transfer rights to Folio Studio        |
| Imported GitHub metadata and creator-entered links/text                             | GitHub repository owners or the creator                                                                                                | Their original terms apply. Public availability is not an asset reuse license                                            |

No stock photography, third-party illustration pack, remote font, CDN asset, GitHub logo, or image-generation concept sheet is required by the four shipped templates. Decorative abstract artwork must not be labeled as a real project screenshot.

The software license is the standard [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), reproduced in [LICENSE](../LICENSE). Development dependencies and CI actions keep their own licenses; they are not bundled portfolio visual assets. See their upstream repositories and the pinned dependency lockfile for applicable terms.

## Adding an asset

Include its path, creator, original source URL (if external), exact license/version, required attribution, and a copy of any required notice. Obtain permission before adding another person's work. Avoid assets whose license only permits use on a specific account, excludes redistribution, or is unclear. Repository samples should be original or have explicit rights for public source distribution and exported-template use.

If an asset has a different license from the code, record that distinction here and beside the file. Do not imply that Apache-2.0 overrides a third-party license or relicenses user content.
