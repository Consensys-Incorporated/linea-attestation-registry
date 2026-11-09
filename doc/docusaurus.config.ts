import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const repositoryUrl = "https://github.com/Consensys/linea-attestation-registry";

const config: Config = {
  title: "Verax Documentation",
  tagline: "A shared attestation registry for EVM chains",
  favicon: "img/logo.svg",
  url: "https://docs.ver.ax",
  baseUrl: "/",
  trailingSlash: false,

  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
      onBrokenMarkdownImages: "throw",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          path: "content",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl: `${repositoryUrl}/tree/dev/doc/`,
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Verax",
      logo: {
        alt: "Verax",
        src: "img/logo.svg",
      },
      items: [
        { href: "https://ver.ax", label: "Website", position: "right" },
        { href: "https://explorer.ver.ax", label: "Explorer", position: "right" },
        { href: repositoryUrl, label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} Consensys`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["solidity", "bash", "json", "graphql"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
