import { GeneralHooks } from '@/models/general-hook'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const baseUrl = '/api/v1/customers'
const queryKey = 'customers'

type CustomerDataModel = {
  id: string
  email: string
  name: string
  created_at: string
}

export const useCustomers = ({
  queryString,
  enableFetch = true,
  limit,
  page,
  orderBy,
  orderDirection,
}: GeneralHooks) => {
  const paginationQuery = `limit=${limit && limit !== 'ALL' ? limit : ''}&page=${limit && limit !== 'ALL' ? page : ''}&order_by=${orderBy}&order_direction=${orderDirection}`

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, queryString, paginationQuery],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}?${queryString}&${paginationQuery}`)
      return {
        result: result.data.result as CustomerDataModel[],
        total: result.data.total as number,
      }
    },
    enabled: !!enableFetch,
  })

  return {
    data: data?.result,
    total: data?.total,
    loading: isLoading,
  }
}
