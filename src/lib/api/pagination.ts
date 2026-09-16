/**
 * Generic paged result envelope. Mirrors
 * `Storporate.SharedKernel.Pagination.PagedResult<T>` in camelCase wire shape.
 * Lives in its own module (rather than `auditLog.ts`) so every future
 * list endpoint imports from one canonical home instead of each feature
 * module re-declaring or cross-importing the contract.
 */
export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}
