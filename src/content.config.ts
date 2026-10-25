import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const source = z.object({
  label: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
});

const entrySchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  order: z.number().int().nonnegative(),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  sources: z.array(source).default([]),
  href: z.url({ protocol: /^https?$/ }).optional(),
  methods: z.array(z.string().min(1)).default([]),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/work' }),
  schema: entrySchema.extend({
    workType: z.enum(['project', 'research']).default('project'),
    overview: z
      .object({
        purpose: z.string().min(1),
        role: z.string().min(1),
        technologies: z.array(z.string().min(1)).min(1),
        capabilities: z.string().min(1),
        engineering: z.string().min(1),
        context: z.string().min(1),
      })
      .optional(),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/research' }),
  schema: entrySchema,
});

const lab = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lab' }),
  schema: entrySchema,
});

export const collections = { work, research, lab };
