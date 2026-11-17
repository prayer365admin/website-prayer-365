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
    // A COUNTRY node is identified by its registry code, not by this placeholder
    // name: the registry owns the country name, so a node created from
    // `countries` is called "Estonia" while this list says "Estonia Country".
    // Matching on the name alone made the seed insert a second EE node and die on
    // the unique `country_code`.
    let row = node.countryCode
      ? await db.orgNode.findFirst({
          where: { kind: node.kind, country_code: node.countryCode },
        })
      : null
    row ??= await db.orgNode.findFirst({ where: { kind: node.kind, name: node.name } })
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
