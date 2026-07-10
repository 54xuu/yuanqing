#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchNotes, getNote } from '../lib/db';

// ---------- Tool handler logic (testable, raw JS objects) ----------

export async function handleSearchNotes({ query }: { query: string }) {
  const results = searchNotes(query);
  return { count: results.length, results };
}

export async function handleGetNote({ id }: { id: string }) {
  const note = getNote(id);
  if (!note) return { error: 'note not found', id };
  return { note };
}

// ---------- MCP tool registrations (wrap handlers in MCP envelope) ----------

function registerTools(server: McpServer): void {
  // Tool: search_notes
  server.tool(
    'search_notes',
    'Search personal notes by keyword. Returns matching notes with id, title, and a content summary.',
    { query: z.string().describe('Search keyword(s)') },
    async ({ query }) => {
      const data = await handleSearchNotes({ query });
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }
  );

  // Tool: get_note
  server.tool(
    'get_note',
    'Get the full content of a note by its id.',
    { id: z.string().describe('Note id (uuid)') },
    async ({ id }) => {
      const data = await handleGetNote({ id });
      const isError = 'error' in data;
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
        ...(isError ? { isError: true } : {}),
      };
    }
  );
}

/**
 * Build a fresh, configured McpServer instance with tools registered.
 * Used by both the stdio entry and the HTTP (`/api/mcp`) transport.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'yuanqing',
    version: '0.1.0',
  });
  registerTools(server);
  return server;
}

// ---------- Start the server with stdio transport ----------

// Only auto-connect when run as the real entry point (e.g. `npm run mcp`).
// Vitest sets process.env.VITEST='true' automatically, so importing this
// module from tests will NOT try to grab stdin/stdout.
if (!process.env.VITEST) {
  (async () => {
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
  })();
}
