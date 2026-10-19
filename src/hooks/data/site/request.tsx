import { MobileRequestAck, MobileRequestInput } from '@/models/mobile'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

/** Website prayer petition (WB3 Home). One Idempotency-Key per submit, so a retried POST never duplicates. */
export const useSubmitRequest = () => {
  const { mutateAsync: onSubmit, isPending: submitting } = useMutation({
    mutationFn: async ({ churchId, input }: { churchId: string; input: MobileRequestInput }) =>
      (
        await axios.post(`/api/v1/site/churches/${encodeURIComponent(churchId)}/requests`, input, {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        })
      ).data.result as MobileRequestAck,
  })
  return { onSubmit, submitting }
}
