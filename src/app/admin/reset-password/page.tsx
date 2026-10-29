import ContentsAdminResetPassword, { metadata } from '@/contents/admin/reset-password'
import redirectAuthenticatedStaff from '@/utils/redirect-authenticated-staff'

export { metadata }

export default async function Page() {
  await redirectAuthenticatedStaff()
  return <ContentsAdminResetPassword />
}
