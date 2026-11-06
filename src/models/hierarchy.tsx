import { z } from 'zod'
import type { OrgNodeKind } from '@prisma/client'

/*
 * Org hierarchy DTOs (SPEC §8.3 / Task 19). Parent-type compatibility is
 * enforced and re-parenting is cycle-rejected.
 */

export const HIERARCHY_PARENT: Record<OrgNodeKind, OrgNodeKind | null> = {
  GLOBAL: null,
  COUNTRY: 'GLOBAL',
  DIOCESE: 'COUNTRY',
  DEANERY: 'DIOCESE',
  CHURCH: 'DEANERY',
}

/** Inverse of HIERARCHY_PARENT: the kind of node that may be added under a kind. */
export const HIERARCHY_CHILD: Record<OrgNodeKind, OrgNodeKind | null> = {
  GLOBAL: 'COUNTRY',
  COUNTRY: 'DIOCESE',
  DIOCESE: 'DEANERY',
  DEANERY: 'CHURCH',
  CHURCH: null,
}

export const NodeKindSchema = z.enum(['GLOBAL', 'COUNTRY', 'DIOCESE', 'DEANERY', 'CHURCH'])

export const NodeCreateSchema = z.object({
  kind: NodeKindSchema,
  parentId: z.string().nullable().optional(),
  name: z.string().min(1),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
})
export type NodeCreate = z.infer<typeof NodeCreateSchema>

export const NodeUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    name: z.string().min(1).optional(),
    parentId: z.string().nullable().optional(),
    move: z.enum(['up', 'down']).optional(),
  })
  .refine((d) => d.name !== undefined || d.parentId !== undefined || d.move !== undefined, {
    message: 'provide at least one field to update',
  })
export type NodeUpdate = z.infer<typeof NodeUpdateSchema>

export const NodeIdSchema = z.object({
  nodeId: z.string().min(1),
})
export type NodeId = z.infer<typeof NodeIdSchema>

export interface HierarchyNode {
  id: string
  kind: OrgNodeKind
  name: string
  parentId: string | null
  countryCode: string | null
  version: number
  children: HierarchyNode[]
}
