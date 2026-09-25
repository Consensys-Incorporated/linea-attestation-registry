# Verax website

Static landing page served at [ver.ax](https://ver.ax/). It replaces the page previously generated and hosted by
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
├── .nojekyll           # Skip Jekyll on GitHub Pages
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

## Deployment (GitHub Pages)

Production is deployed from the `dev` branch by
[`.github/workflows/website-pages.yml`](../.github/workflows/website-pages.yml). There is no build step: the workflow
archives `website/`, uploads a Pages artifact, and runs `deploy-pages`.

We do **not** use `actions/upload-pages-artifact`: that composite action references `actions/upload-artifact@v4`
(without a commit SHA), which Consensys-Incorporated action policy rejects. The workflow calls
`actions/upload-artifact@<full-sha>` directly with the same tar layout Pages expects.

### One-time repository settings

In **Settings → Pages** for this repository:

1. **Build and deployment → Source**: **GitHub Actions**.
2. **Custom domain**: `ver.ax` (must match the canonical URL in `index.html` and `sitemap.xml`).
3. **Enforce HTTPS**: enabled after DNS validation succeeds.

In **Settings → Actions → General → Workflow permissions**, allow workflows to publish Pages (`pages: write`, typically
**Read and write** permissions).

The first successful run uses the **`github-pages`** environment; approve it if your org requires environment review.

### DNS (`ver.ax`)

At your DNS provider, remove legacy records pointing to the previous host. Configure GitHub’s recommended records (see
[GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)):

| Host  | Type    | Value                                                                      |
| ----- | ------- | -------------------------------------------------------------------------- |
| `@`   | `A`     | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `www` | `CNAME` | `consensys-incorporated.github.io` (optional)                              |

Wait until **Settings → Pages** validates the domain, then verify `https://ver.ax/` and `https://ver.ax/robots.txt`.

### Rollback

Re-run a previous successful **Website GitHub Pages** workflow from **Actions**, or revert the `website/` commit on
`dev` and let the workflow republish.

Other Verax surfaces (for example [explorer.ver.ax](https://explorer.ver.ax)) stay on their own hosts; only the apex
marketing site uses GitHub Pages.

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
