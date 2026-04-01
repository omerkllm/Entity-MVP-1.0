export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parses `page` and `limit` from URL search params.
 * Defaults: page=1, limit=50. Hard cap: limit=200.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  const rawPage = parseInt(searchParams.get('page') ?? '', 10);
  const rawLimit = parseInt(searchParams.get('limit') ?? '', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Extracts a PaginatedResult from query rows that include a `total` window count.
 * Eliminates the duplicated total-parsing boilerplate in every query file.
 */
export function extractPaginatedResult<T>(
  rows: (T & { total: string })[],
  { page, limit }: Pick<PaginationParams, 'page' | 'limit'>,
): PaginatedResult<T> {
  const total = rows.length > 0 ? parseInt(rows[0].total, 10) : 0;
  const data = rows.map(({ total: _t, ...rest }) => rest as T);
  return { data, total, page, limit };
}
