# Verax Documentation

Source of the Verax documentation, built with [Docusaurus](https://docusaurus.io/).

- Pages live in `docs/`. The sidebar order is defined in `sidebars.ts`.
- Images live in `static/img/`.

## Commands

From the monorepo root:

```bash
pnpm --filter @verax-attestation-registry/verax-doc dev
pnpm --filter @verax-attestation-registry/verax-doc build
```

The build fails on broken links, anchors, and images.
