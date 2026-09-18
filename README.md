# hardcover-mcp

MCP server exposing your own [Hardcover.app](https://hardcover.app) library,
reviews and reading progress as tools — built for feeding real, on-brand
book context into the `ivdorado.es` post-generation project, but usable
standalone.

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

## Tools exposed

| Tool | Purpose |
|---|---|
| `hardcover_me` | Confirm auth, get your user id |
| `hardcover_search_books` | Search the catalog |
| `hardcover_get_book` | Book details by id or slug |
| `hardcover_get_library` | Your books, optionally filtered by status |
| `hardcover_currently_reading` | Currently-reading books with page progress |
| `hardcover_get_reviews` | Your own written reviews/ratings |

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
