# hardcover-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

An MCP server that exposes your own [Hardcover.app](https://hardcover.app)
library, reviews and reading progress as tools — so any MCP-compatible
LLM client (Claude, and others) can answer questions about your reading
life, or use it as real, personal context for something else you're
building (a blog automation, a yearly reading recap, whatever).

It's a thin wrapper around Hardcover's GraphQL API: no database, no
server to host, just a stdio process your MCP client launches.

## What you can do with it

Once connected, you can ask your LLM client things like:

- *"What am I currently reading, and how far in am I?"*
- *"List the sci-fi books I've read and rated 4 stars or higher."*
- *"Search Hardcover for books by Ted Chiang."*
- *"Pull my written reviews from the last few months — I want to spot
  patterns in what I complain about."*

The client calls the tools below, gets back real JSON from your Hardcover
account, and reasons over it like any other tool result.

## Setup

1. **Get an API token**: [hardcover.app/account/api](https://hardcover.app/account/api) → *New API Key*.
   Give it a scope covering at least reading `user_books`, `books`, and search.
   Free plan: 5,000 requests/day, 60/min, burst of 10 — plenty for this use case.

2. **Install deps**

   ```bash
   cd hardcover-mcp
   npm install
   ```

3. **Set your token**

   ```bash
   export HARDCOVER_API_TOKEN="your-token-here"
   ```

4. **Run it**

   ```bash
   npm start
   ```

   It speaks MCP over stdio — point your MCP client's config at
   `node /path/to/hardcover-mcp/index.js` with `HARDCOVER_API_TOKEN` in its
   environment.

### Registering with Claude Code

```bash
claude mcp add hardcover -s local -e HARDCOVER_API_TOKEN="your-token-here" -- node /path/to/hardcover-mcp/index.js
```

`-s local` keeps it scoped to your user + this project (stored outside the
repo, never committed). Restart Claude Code (or start a new session) for the
`hardcover_*` tools to show up.

### Registering with Claude Desktop (or any client using `mcpServers` JSON)

Add this to your client's MCP config file (for Claude Desktop:
`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hardcover": {
      "command": "node",
      "args": ["/path/to/hardcover-mcp/index.js"],
      "env": {
        "HARDCOVER_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart the client for the `hardcover_*` tools to show up.

## Tools exposed

| Tool | Purpose |
|---|---|
| `hardcover_me` | Confirm auth, get your user id |
| `hardcover_search_books` | Search the catalog |
| `hardcover_get_book` | Book details by id or slug |
| `hardcover_get_library` | Your books, optionally filtered by status |
| `hardcover_currently_reading` | Currently-reading books with page progress |
| `hardcover_get_reviews` | Your own written reviews/ratings |

### Example: `hardcover_currently_reading`

Response shape (trimmed):

```json
[
  {
    "user_book_reads": [{ "progress_pages": 210, "started_at": "2026-08-01" }],
    "book": {
      "title": "Project Hail Mary",
      "pages": 476,
      "contributions": [{ "author": { "name": "Andy Weir" } }]
    }
  }
]
```

## Notes / constraints from Hardcover's API terms

- **Backend-only.** Never call this from a browser — keep the token on a
  server or your own machine only. This server assumes that (stdio, not HTTP).
- **Beta API**: schema and tokens can change or reset without notice.
- **Personal data only**: don't expose other users' reviews/library/ratings
  through anything public — this server only ever queries *your own* id
  (`hardcover_me` → cached `user_id`), which keeps it inside the personal-use
  terms.
- **Not for training publicly-released or commercial LLMs.** Fine for this —
  reading your own data into a chat to help you draft — but keep in mind if
  this ever becomes a packaged product.
- Rate-limit headers (`RateLimit`, `RateLimit-Policy`) come back on every
  response if you want to add backoff logic later; not wired up here yet.

## Known gaps (skeleton, not finished)

- No pagination helpers beyond passing `limit`/`offset` through.
- `search` endpoint's exact result shape wasn't fully documented publicly at
  time of writing — `hardcover_search_books` returns the raw `results` field
  as-is; you may need to adjust parsing once you see a live response.
- No write operations (e.g. marking a book as read) — read-only by design
  for now, add mutations later if you want the automation to log books too.
- No retry/backoff on `429`.

## Contributing

Issues and PRs welcome — this started as a personal tool, so there are
rough edges (see *Known gaps* above). If you build something on top of it
(a blog pipeline, a reading-stats dashboard, whatever), I'd love to hear
about it.
