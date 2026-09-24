# Verax website

Static landing page served at [ver.ax](https://www.ver.ax/). It replaces the page previously generated and hosted by
onepage.io.

The site is plain HTML, CSS and a small vanilla JavaScript file: there is no build step and no runtime dependency. All
assets (images, fonts) are self-hosted, and the page sets no cookies and loads no third-party script.

## Structure

```text
website/
├── index.html          # Page content and metadata
├── styles.css          # Design tokens, layout and components
├── main.js             # Mobile navigation menu
├── robots.txt
├── sitemap.xml
└── assets/
    ├── fonts/          # Wix Madefor Display & Text (woff2) + OFL license
    └── images/         # Logos, partner logos, screenshots
```

The page works without JavaScript: the navigation is then always visible. The mobile menu is only collapsed when
`main.js` can run.

## Local preview

Serve the folder with any static file server, for example:

```bash
cd website
python3 -m http.server 4173
```

Then open <http://localhost:4173/>.

## Deployment

Deploy the content of `website/` as-is to any static hosting provider and point the `ver.ax` / `www.ver.ax` DNS records
to it. The canonical URL declared in `index.html` and `sitemap.xml` is `https://www.ver.ax/`.

## Quality checks

The folder is covered by the repository-wide tooling:

```bash
pnpm lint
pnpm prettier:check
```

## Licenses

- Fonts: [Wix Madefor](https://github.com/wix-incubator/wixmadefor), SIL Open Font License 1.1 (see
  `assets/fonts/OFL.txt`).
- Hero background: photo from [Unsplash](https://unsplash.com/license).
