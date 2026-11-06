import { db } from '../../src/utils/db-connection'
import type { OrgNodeKind } from '@prisma/client'

/*
 * Placeholder org hierarchy (testing), matching SPEC §5.1 structure:
 * GLOBAL > COUNTRY > DIOCESE > DEANERY > CHURCH.
 * One global root; each node is upserted idempotently by (kind, name).
 */

const NODES: { kind: OrgNodeKind; name: string; countryCode?: string }[] = [
  { kind: 'GLOBAL', name: 'PRAYER Global Root' },
  // A COUNTRY node is linked to its registry row; the registry owns the name.
  { kind: 'COUNTRY', name: 'Estonia Country', countryCode: 'EE' },
  { kind: 'DIOCESE', name: 'Estonia Diocese' },
  { kind: 'DEANERY', name: 'Estonia Deanery' },
  { kind: 'CHURCH', name: 'Tallinn Demo Church Node' },
]

export const seedOrgNodes = async () => {
  let parentId: string | null = null
  for (const node of NODES) {
    let row = await db.orgNode.findFirst({ where: { kind: node.kind, name: node.name } })
    if (!row) {
      row = await db.orgNode.create({
        data: {
          kind: node.kind,
          name: node.name,
          parent_id: parentId,
          country_code: node.countryCode,
        },
      })
    } else if (node.countryCode && !row.country_code) {
      // Older runs created the COUNTRY node without its registry link.
      row = await db.orgNode.update({
        where: { id: row.id },
        data: { country_code: node.countryCode },
      })
    }
    parentId = row.id
  }
}
