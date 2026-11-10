import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL } from '@/config/site-brand'
import type { MobilePublicChurch } from '@/models/mobile'

const clip = (value: string, max = 155) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`

/**
 * Head tags for one public church page, built from the church row itself.
 * The slug is the canonical URL, so the member page and the public page never
 * disagree about which address is authoritative.
 */
export function churchMetadata(church: MobilePublicChurch): Metadata {
  const city = church.address.city
  // One em dash only: the root layout template appends "— Prayer 365".
  const title = `${church.name} — ${city}`
  const kind = church.denomination ? `${church.denomination} church` : 'church'
  const description = church.description
    ? clip(church.description)
    : `${church.name} is a ${kind} in ${city} on ${SITE_NAME}. Address, service times and contact details.`
  const canonical = `/churches/${church.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      images: church.coverUrl ? [{ url: church.coverUrl, alt: church.name }] : undefined,
    },
  }
}

/**
 * schema.org `Church` for the same row. Every optional field is undefined-gated:
 * JSON.stringify drops undefined keys, so a sparse row never emits `null`s.
 */
export function churchJsonLd(church: MobilePublicChurch) {
  const street = [church.address.line1, church.address.line2].filter(Boolean).join(', ')

  return {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: church.name,
    url: `${SITE_URL}/churches/${church.slug}`,
    description: church.description ?? undefined,
    image: church.coverUrl ?? undefined,
    telephone: church.contacts.phone ?? undefined,
    email: church.contacts.email ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: street,
      addressLocality: church.address.city,
      postalCode: church.address.postalCode ?? undefined,
      addressCountry: church.address.countryCode,
    },
    geo: church.coordinates
      ? {
          '@type': 'GeoCoordinates',
          latitude: church.coordinates.latitude,
          longitude: church.coordinates.longitude,
        }
      : undefined,
    sameAs: church.website ? [church.website] : undefined,
  }
}
