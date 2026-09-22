#!/usr/bin/env node
// Hardcover MCP server — exposes your Hardcover.app library as MCP tools.
// Run over stdio, meant to be launched by an MCP client (e.g. Claude).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HardcoverClient, STATUS } from "./hardcover-client.js";

const token = process.env.HARDCOVER_API_TOKEN;
const client = new HardcoverClient(token);

// Cache "me" so tools that need a user_id don't have to be told it every time.
let cachedUserId = null;
async function resolveUserId() {
  if (cachedUserId) return cachedUserId;
  const me = await client.me();
  cachedUserId = me.id;
  return cachedUserId;
}

const server = new Server(
  { name: "hardcover-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "hardcover_me",
    description: "Get the authenticated Hardcover user's id, username and name.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hardcover_search_books",
    description: "Search Hardcover's catalog for books by title, author, etc.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text." },
        limit: { type: "integer", description: "Max results (default 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "hardcover_get_book",
    description: "Get details for a single book by Hardcover id or slug.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Hardcover book id." },
        slug: { type: "string", description: "Hardcover book slug." },
      },
    },
  },
  {
    name: "hardcover_get_library",
    description:
      "List books from your library, optionally filtered by status (want_to_read, currently_reading, read, paused, did_not_finish).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: Object.keys(STATUS).map((k) => k.toLowerCase()),
          description: "Optional status filter.",
        },
        limit: { type: "integer", description: "Default 25." },
        offset: { type: "integer", description: "Default 0." },
      },
    },
  },
  {
    name: "hardcover_currently_reading",
    description:
      "List books currently being read, including page progress and start date.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hardcover_get_reviews",
    description: "List your own written reviews and ratings.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Default 10." },
        offset: { type: "integer", description: "Default 0." },
      },
    },
  },
  {
    name: "hardcover_recently_read",
    description:
      "List books you've finished, most recently read first (by last_read_date).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Default 20." },
      },
    },
  },
  {
    name: "hardcover_get_lists",
    description: "List your Hardcover lists (name, description, book count).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hardcover_get_list_books",
    description: "Get the books in one of your lists, in list order.",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "integer", description: "List id (from hardcover_get_lists)." },
        limit: { type: "integer", description: "Default 50." },
        offset: { type: "integer", description: "Default 0." },
      },
      required: ["listId"],
    },
  },
  {
    name: "hardcover_reading_goal",
    description: "Get your reading goal(s) and current progress.",
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: {
          type: "boolean",
          description: "Only return the currently active goal (default true).",
        },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "hardcover_me": {
        const me = await client.me();
        cachedUserId = me.id;
        return textResult(me);
      }

      case "hardcover_search_books": {
        const results = await client.searchBooks(args.query, args.limit ?? 10);
        return textResult(results);
      }

      case "hardcover_get_book": {
        if (!args.id && !args.slug) {
          throw new Error("Provide either id or slug.");
        }
        const book = await client.getBook(args);
        return textResult(book);
      }

      case "hardcover_get_library": {
        const userId = await resolveUserId();
        const statusId = args.status
          ? STATUS[args.status.toUpperCase()]
          : undefined;
        const books = await client.getUserLibrary({
          userId,
          statusId,
          limit: args.limit ?? 25,
          offset: args.offset ?? 0,
        });
        return textResult(books);
      }

      case "hardcover_currently_reading": {
        const userId = await resolveUserId();
        const books = await client.getCurrentlyReadingWithProgress({ userId });
        return textResult(books);
      }

      case "hardcover_get_reviews": {
        const userId = await resolveUserId();
        const reviews = await client.getUserReviews({
          userId,
          limit: args.limit ?? 10,
          offset: args.offset ?? 0,
        });
        return textResult(reviews);
      }

      case "hardcover_recently_read": {
        const userId = await resolveUserId();
        const books = await client.getRecentlyRead({
          userId,
          limit: args.limit ?? 20,
        });
        return textResult(books);
      }

      case "hardcover_get_lists": {
        const userId = await resolveUserId();
        const lists = await client.getLists({ userId });
        return textResult(lists);
      }

      case "hardcover_get_list_books": {
        if (!args.listId) throw new Error("Provide listId.");
        const books = await client.getListBooks({
          listId: args.listId,
          limit: args.limit ?? 50,
          offset: args.offset ?? 0,
        });
        return textResult(books);
      }

      case "hardcover_reading_goal": {
        const userId = await resolveUserId();
        const goals = await client.getReadingGoals({
          userId,
          activeOnly: args.activeOnly ?? true,
        });
        return textResult(goals);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

const transport = new StdioServerTransport();
await server.connect(transport);
