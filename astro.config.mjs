// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// CI (GitHub Pages) injects SITE and BASE from actions/configure-pages, so
// the same build works on <user>.github.io/<repo> and on a custom domain.
const site = process.env.SITE || 'https://hugogresse.github.io/2srt2ass';
const base = process.env.BASE || undefined;

// https://astro.build/config
export default defineConfig({
  site,
  base,
  integrations: [preact()],
});
