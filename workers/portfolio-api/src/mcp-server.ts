import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  getCaseStudy,
  getResearch,
  index,
  listProjects,
  searchPortfolio,
} from './content';
import type { PublicDocument } from '../../../src/lib/portfolio/types';

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const empty = z.strictObject({});
const document = ({ id, title, path, passages }: PublicDocument) => ({
  id,
  title,
  url: `https://jorgeaviles.net${path}`,
  passages: passages.map(({ id, text }) => ({ id, text })),
});
function result(data: Record<string, unknown>, isError = false) {
  const structuredContent = { indexVersion: index.version, ...data };
  const text = JSON.stringify(structuredContent);
  if (new TextEncoder().encode(text).byteLength > 12_000)
    throw new Error('Public output exceeds limit');
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent,
    ...(isError ? { isError } : {}),
  };
}

// A fresh instance for each HTTP request. This factory has no AI, fetch, files,
// credentials, sessions or mutable visitor state; all content is the curated index.
export function createPortfolioServer() {
  const server = new McpServer({
    name: 'jorge-aviles-portfolio',
    version: '1.0.0',
  });
  server.registerTool(
    'list_projects',
    {
      description:
        'List approved public professional projects and their canonical source URLs.',
      inputSchema: empty,
      annotations,
    },
    async () => result({ projects: listProjects() }),
  );
  server.registerTool(
    'get_case_study',
    {
      description:
        'Retrieve curated public passages for one project ID from list_projects. Preserves experimental status and evaluation limitations.',
      inputSchema: z.strictObject({
        id: z
          .string()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9-]+$/),
      }),
      annotations,
    },
    async ({ id }) => {
      const item = getCaseStudy(id);
      return item
        ? result({ caseStudy: document(item) })
        : result(
            { error: 'Project not found. Use list_projects for approved IDs.' },
            true,
          );
    },
  );
  server.registerTool(
    'search_portfolio',
    {
      description:
        'Search approved public About, project and research passages. Empty results mean the sources do not support the query. Query is text, never a URL or file to retrieve.',
      inputSchema: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .refine((text) =>
            [...text].every(
              (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
            ),
          ),
        limit: z.number().int().min(1).max(6).optional(),
      }),
      annotations,
    },
    async ({ query, limit }) =>
      result({
        passages: searchPortfolio(query, limit).map(
          ({ id, title, url, text }) => ({ id, title, url, text }),
        ),
      }),
  );
  server.registerTool(
    'get_research',
    {
      description:
        'Retrieve approved research information with source URLs. Research assistance must not be described as paper authorship.',
      inputSchema: empty,
      annotations,
    },
    async () => result({ research: getResearch().map(document) }),
  );
  return server;
}
