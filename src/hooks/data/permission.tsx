import { PermissionDataModel } from '@/models/permission'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const baseUrl = '/api/v1/permissions'
const queryKey = 'permissions'

export const usePermissions = () => {
  const { data: data, isLoading: fetchLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const result = await axios.get(`${baseUrl}`)
      return result.data.result as PermissionDataModel[]
    },
  })

  return {
    data,
    loading: fetchLoading,
  }
}
