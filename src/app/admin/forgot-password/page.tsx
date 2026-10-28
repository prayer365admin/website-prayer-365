import ContentsAdminForgotPassword, { metadata } from '@/contents/admin/forgot-password'
import redirectAuthenticatedStaff from '@/utils/redirect-authenticated-staff'

export { metadata }

export default async function Page() {
  await redirectAuthenticatedStaff()
  return <ContentsAdminForgotPassword />
}
