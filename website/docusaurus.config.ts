import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// GitHub Pages deployment config. Adjust ORG/REPO to your repository, or change
// `url`/`baseUrl` if you deploy to Vercel/Netlify/a custom domain.
const ORG = 'your-org';
const REPO = 'declarative-sf-metadata';

const config: Config = {
  title: 'declarative-sf-metadata',
  tagline: 'Define Salesforce custom objects and fields declaratively in YAML',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: `https://${ORG}.github.io`,
  baseUrl: `/${REPO}/`,

  organizationName: ORG,
  projectName: REPO,

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // docs are the site root — no React landing page
          editUrl: `https://github.com/${ORG}/${REPO}/tree/main/website/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'declarative-sf-metadata',
      logo: {
        alt: 'declarative-sf-metadata logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: `https://github.com/${ORG}/${REPO}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/'},
            {label: 'Getting started', to: '/getting-started'},
            {label: 'CLI reference', to: '/cli'},
          ],
        },
        {
          title: 'Guides',
          items: [
            {label: 'Data model', to: '/model/data-model'},
            {label: 'Field types', to: '/model/field-types'},
            {label: 'Master-detail', to: '/features/master-detail'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: `https://github.com/${ORG}/${REPO}`},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} declarative-sf-metadata. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
