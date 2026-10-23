import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jorgeaviles.net',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    react(),
    sitemap({ filter: (page) => !page.endsWith('/404/') }),
  ],
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
