import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jorgeaviles.net',
  output: 'static',
  trailingSlash: 'always',
  redirects: { '/work/applied-predictive-research/': '/research/' },
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) =>
        !page.endsWith('/404/') &&
        !page.endsWith('/work/applied-predictive-research/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
