import type { OrgNodeKind } from '@prisma/client'

export const KIND_LABEL: Record<OrgNodeKind, string> = {
  GLOBAL: 'Global',
  COUNTRY: 'Country',
  DIOCESE: 'Diocese',
  DEANERY: 'Deanery',
  CHURCH: 'Church',
}

/** Pill palette from the design (Figma 94-11597): one tint per kind. */
export const KIND_PILL: Record<OrgNodeKind, string> = {
  GLOBAL: 'border-[#b9d8f8] bg-[#e6edfb] text-[#2f7ad2]',
  CHURCH: 'border-[#b9d8f8] bg-[#e6edfb] text-[#2f7ad2]',
  COUNTRY: 'border-[#d3faef] bg-[#edfdf9] text-[#09a97c]',
  DIOCESE: 'border-[#fbeec6] bg-[#fefcf6] text-[#d8a50e]',
  DEANERY: 'border-[#f7caca] bg-[#fef6f6] text-[#b31a1a]',
}

/** Left rail on a nested group, taken from the parent's kind so depth reads at a glance. */
export const KIND_RAIL: Record<OrgNodeKind, string> = {
  GLOBAL: 'border-[#b9d8f8]',
  CHURCH: 'border-[#b9d8f8]',
  COUNTRY: 'border-[#d3faef]',
  DIOCESE: 'border-[#fbeec6]',
  DEANERY: 'border-[#f7caca]',
}
