import { db } from '../../src/utils/db-connection'
import {
  PLATFORM_CHURCH_NAME,
  PLATFORM_CHURCH_SLUG,
  PLATFORM_CHURCH_TIMEZONE,
  PLATFORM_DONATION_CURRENCY,
  PLATFORM_DONATION_PRESETS_MINOR,
} from '../../src/config/platform-church'

/*
 * The hidden platform beneficiary (PD-DB-03). Every public gift from `/give` is
 * attributed to this row, because `donations.church_id` is required and the
 * payment-sync worker skips events without a `metadata.churchId`.
 *
 * The row is:
 *  - APPROVED, so `ENSURE_CHURCH_DONATION_ELIGIBLE` accepts it;
 *  - `is_platform = true`, so every public directory surface filters it out and
 *    the central admin guards refuse to edit/suspend/delete it;
 *  - owned by a CHURCH org node with NO role assignment, so it never appears in a
 *    staff account's scoped church list.
 *
 * Idempotent: safe to run on every seed. The update path self-heals the flag,
 * the status and the donation options, because either of them regressing would
 * turn `/give` into a 400/404.
 */
export const seedPlatformChurch = async () => {
  let node = await db.orgNode.findFirst({
    where: { kind: 'CHURCH', name: PLATFORM_CHURCH_NAME },
  })
  if (!node) {
    node = await db.orgNode.create({
      data: {
        kind: 'CHURCH',
        name: PLATFORM_CHURCH_NAME,
        parent_id: null,
        country_code: null,
      },
    })
  }

  const donationOptions = {
    currency: PLATFORM_DONATION_CURRENCY,
    presetsMinor: PLATFORM_DONATION_PRESETS_MINOR,
    // Monthly giving stays a signed-in feature (D-04).
    monthlyEnabled: false,
  }

  const existing = await db.church.findUnique({ where: { slug: PLATFORM_CHURCH_SLUG } })
  if (!existing) {
    await db.church.create({
      data: {
        org_node_id: node.id,
        name: PLATFORM_CHURCH_NAME,
        slug: PLATFORM_CHURCH_SLUG,
        status: 'APPROVED',
        is_platform: true,
        timezone: PLATFORM_CHURCH_TIMEZONE,
        address: {},
        contacts: { email: null, phone: null },
        social_links: [],
        donation_options: donationOptions,
        // No admin actor approves the platform row; both stay null.
        approved_by: null,
        approved_at: null,
      },
    })
    return
  }

  // A real parish that happens to own the slug must never be converted into the
  // platform beneficiary: that would hide a live church and redirect its gifts.
  if (!existing.is_platform) {
    throw new Error(
      `A non-platform church already owns slug "${PLATFORM_CHURCH_SLUG}"; refusing to convert it to the platform beneficiary.`,
    )
  }

  await db.church.update({
    where: { id: existing.id },
    data: {
      is_platform: true,
      status: 'APPROVED',
      donation_options: donationOptions,
    },
  })
}
