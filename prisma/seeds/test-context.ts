import { db } from '../../src/utils/db-connection'

/*
 * Shared lookups for the placeholder test data graph.
 * Entity seeds reuse the same demo church/pastor by stable keys.
 */

export const DEMO_CHURCH_NAME = 'Tallinn Demo Church'
export const DEMO_CHURCH_NODE_NAME = 'Tallinn Demo Church Node'
export const DEMO_PASTOR_NAME = 'Pastor Demo Tamm'

export const getDemoChurch = async () => db.church.findFirst({ where: { name: DEMO_CHURCH_NAME } })
export const getDemoChurchNode = async () =>
  db.orgNode.findFirst({ where: { name: DEMO_CHURCH_NODE_NAME } })
export const getDemoPastor = async () => db.pastor.findFirst({ where: { name: DEMO_PASTOR_NAME } })
export const getAdminUser = async () =>
  db.user.findUnique({ where: { email: 'admin@catatia.com' } })
export const getPastorUser = async () =>
  db.user.findUnique({ where: { email: 'prayer_pastor@example.com' } })
