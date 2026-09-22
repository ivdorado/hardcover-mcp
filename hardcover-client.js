// Thin wrapper around the Hardcover GraphQL API.
// Docs: https://docs.hardcover.app/api/getting-started/

const ENDPOINT = "https://api.hardcover.app/v1/graphql";

// status_id values used across the Hardcover API (confirmed in their docs/community guides)
export const STATUS = {
  WANT_TO_READ: 1,
  CURRENTLY_READING: 2,
  READ: 3,
  PAUSED: 4,
  DID_NOT_FINISH: 5,
};

export class HardcoverClient {
  constructor(token) {
    if (!token) {
      throw new Error(
        "Missing HARDCOVER_API_TOKEN. Create one at https://hardcover.app/account/api"
      );
    }
    this.token = token;
  }

  async request(query, variables = {}, attempt = 0) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${this.token}`,
        "user-agent": "hardcover-mcp/0.1",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429 && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** attempt; // 500ms, 1s, 2s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return this.request(query, variables, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Hardcover API HTTP ${res.status}: ${body}`);
    }

    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(
        `Hardcover API error: ${json.errors.map((e) => e.message).join("; ")}`
      );
    }
    return json.data;
  }

  async me() {
    const data = await this.request(`query { me { id username name } }`);
    return data.me[0];
  }

  async searchBooks(query, limit = 10) {
    // Search queries have their own 2s timeout server-side and count as a
    // single "search" top-level query against the 5-per-request limit.
    const data = await this.request(
      `query Search($query: String!, $limit: Int!) {
        search(query: $query, query_type: "Book", per_page: $limit) {
          results
        }
      }`,
      { query, limit }
    );
    return data.search?.results;
  }

  async getBook({ id, slug }) {
    const where = id ? `{ id: { _eq: $id } }` : `{ slug: { _eq: $slug } }`;
    const data = await this.request(
      `query GetBook($id: Int, $slug: String) {
        books(where: ${where}, limit: 1) {
          id
          title
          slug
          pages
          release_date
          description
          image { url }
          contributions { author { name } }
        }
      }`,
      { id, slug }
    );
    return data.books?.[0];
  }

  async getUserLibrary({ userId, statusId, limit = 25, offset = 0 }) {
    const where = statusId
      ? `{ user_id: { _eq: $userId }, status_id: { _eq: $statusId } }`
      : `{ user_id: { _eq: $userId } }`;
    const data = await this.request(
      `query GetLibrary($userId: Int!, $statusId: Int, $limit: Int!, $offset: Int!) {
        user_books(
          where: ${where}
          distinct_on: book_id
          limit: $limit
          offset: $offset
        ) {
          status_id
          rating
          book {
            id
            title
            pages
            release_date
            image { url }
            contributions { author { name } }
          }
        }
      }`,
      { userId, statusId, limit, offset }
    );
    return data.user_books;
  }

  async getCurrentlyReadingWithProgress({ userId }) {
    const data = await this.request(
      `query CurrentlyReading($userId: Int!) {
        user_books(
          where: { user_id: { _eq: $userId }, status_id: { _eq: ${STATUS.CURRENTLY_READING} } }
        ) {
          user_book_reads { progress_pages started_at }
          book {
            title
            pages
            image { url }
            contributions { author { name } }
          }
        }
      }`,
      { userId }
    );
    return data.user_books;
  }

  async getUserReviews({ userId, limit = 10, offset = 0 }) {
    const data = await this.request(
      `query Reviews($userId: Int!, $limit: Int!, $offset: Int!) {
        user_books(
          where: { user_id: { _eq: $userId }, review: { _is_null: false } }
          limit: $limit
          offset: $offset
        ) {
          rating
          review
          book { title contributions { author { name } } }
        }
      }`,
      { userId, limit, offset }
    );
    return data.user_books;
  }

  async getRecentlyRead({ userId, limit = 20 }) {
    const data = await this.request(
      `query RecentlyRead($userId: Int!, $limit: Int!) {
        user_books(
          where: { user_id: { _eq: $userId }, status_id: { _eq: ${STATUS.READ} } }
          order_by: { last_read_date: desc_nulls_last }
          limit: $limit
        ) {
          rating
          last_read_date
          review
          book {
            id
            title
            pages
            image { url }
            contributions { author { name } }
          }
        }
      }`,
      { userId, limit }
    );
    return data.user_books;
  }

  async getLists({ userId }) {
    const data = await this.request(
      `query Lists($userId: Int!) {
        lists(where: { user_id: { _eq: $userId } }, order_by: { name: asc }) {
          id
          name
          description
          slug
          books_count
          public
        }
      }`,
      { userId }
    );
    return data.lists;
  }

  async getListBooks({ listId, limit = 50, offset = 0 }) {
    const data = await this.request(
      `query ListBooks($listId: Int!, $limit: Int!, $offset: Int!) {
        list_books(
          where: { list_id: { _eq: $listId } }
          order_by: { position: asc }
          limit: $limit
          offset: $offset
        ) {
          position
          book {
            id
            title
            pages
            release_date
            image { url }
            contributions { author { name } }
          }
        }
      }`,
      { listId, limit, offset }
    );
    return data.list_books;
  }

  async getReadingGoals({ userId, activeOnly = true }) {
    const where = activeOnly
      ? `{ user_id: { _eq: $userId }, state: { _eq: "active" } }`
      : `{ user_id: { _eq: $userId } }`;
    const data = await this.request(
      `query Goals($userId: Int!) {
        goals(where: ${where}, order_by: { start_date: desc }) {
          id
          goal
          progress
          metric
          start_date
          end_date
          state
          description
        }
      }`,
      { userId }
    );
    return data.goals;
  }
}
