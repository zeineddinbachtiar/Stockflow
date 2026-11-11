export interface PaginationQuery {
  limit: number;
  offset: number;
}

export interface PaginatedRecords<T> {
  items: T[];
  total: number;
}
