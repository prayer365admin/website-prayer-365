export interface GeneralHooks {
  queryString?: string
  search?: string
  enableFetch?: boolean
  limit?: number | 'ALL'
  page?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}
