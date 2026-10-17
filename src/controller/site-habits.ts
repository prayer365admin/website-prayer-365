import { SiteHabits } from '@/models/site-habits'
import { GET_MY_HABITS } from '@/providers/site-habits'

export const getMyHabits = ({ userId }: { userId: string }): Promise<SiteHabits> =>
  GET_MY_HABITS({ userId })
