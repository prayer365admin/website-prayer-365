import ContentsAdminSignIn, { metadata } from '@/contents/admin/sign-in'
import redirectAuthenticatedStaff from '@/utils/redirect-authenticated-staff'

export { metadata }

export default async function Page() {
  await redirectAuthenticatedStaff()
  return <ContentsAdminSignIn />
}
