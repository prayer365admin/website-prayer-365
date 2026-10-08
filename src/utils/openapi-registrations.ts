/*
 * Server-startup OpenAPI registrations (plan Task 8 / Phase 1).
 *
 * Every endpoint route module calls registerPath() at module scope. For each
 * path to appear in GET /api/v1/openapi.json, its module MUST be imported here
 * so the side-effect registration runs before openApiDocument() is serialized.
 * TODO: keep in sync with the api route tree — anything missing here is a live
 * endpoint that is absent from the published spec.
 */

// --- Staff identity + access (Phase 1) ---
import '@/app/api/v1/admin/me/route'
import '@/app/api/v1/admin/access/route'
import '@/app/api/v1/users/route'
import '@/app/api/v1/users/[id]/route'
import '@/app/api/v1/customers/route'
import '@/app/api/v1/roles/route'
import '@/app/api/v1/roles/[id]/route'
import '@/app/api/v1/permissions/route'

// --- Church admin (Phase 2): list, overview, profile, service-times, pastors ---
import '@/app/api/v1/admin/churches/route'
import '@/app/api/v1/admin/churches/[churchId]/overview/route'
import '@/app/api/v1/admin/churches/[churchId]/profile/route'
import '@/app/api/v1/admin/churches/[churchId]/service-times/route'
import '@/app/api/v1/admin/churches/[churchId]/pastors/route'
import '@/app/api/v1/admin/churches/[churchId]/pastors/[pastorId]/route'

// --- Church content (Phase 4): prayers / events / announcements ---
import '@/app/api/v1/admin/churches/[churchId]/prayers/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/approve-text/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/audio/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/audio/[audioId]/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/audio/[audioId]/approve/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/schedule/route'
import '@/app/api/v1/admin/churches/[churchId]/prayers/[prayerId]/publish/route'
import '@/app/api/v1/admin/churches/[churchId]/events/route'
import '@/app/api/v1/admin/churches/[churchId]/events/[eventId]/route'
import '@/app/api/v1/admin/churches/[churchId]/announcements/route'
import '@/app/api/v1/admin/churches/[churchId]/announcements/[announcementId]/route'
import '@/app/api/v1/admin/churches/[churchId]/announcements/[announcementId]/publish/route'
import '@/app/api/v1/admin/churches/[churchId]/announcements/[announcementId]/unpublish/route'

// --- Sensitive requests (Phase 5) ---
import '@/app/api/v1/admin/churches/[churchId]/requests/route'
import '@/app/api/v1/admin/churches/[churchId]/requests/[requestId]/route'

// --- Donations + analytics read (Phase 6) ---
import '@/app/api/v1/admin/churches/[churchId]/donations/route'
import '@/app/api/v1/admin/churches/[churchId]/donation-subscriptions/route'
import '@/app/api/v1/admin/churches/[churchId]/donation-summary/route'
import '@/app/api/v1/admin/churches/[churchId]/analytics/route'
import '@/app/api/v1/admin/churches/[churchId]/attendance-summary/route'
import '@/app/api/v1/admin/regions/[regionId]/summary/route'

// --- Central admin (Phase 3): role-assignments, churches, lifecycle, registry ---
import '@/app/api/v1/admin/central/role-assignments/route'
import '@/app/api/v1/admin/central/role-assignments/[assignmentId]/route'
import '@/app/api/v1/admin/central/announcements/route'
import '@/app/api/v1/admin/central/announcements/[announcementId]/route'
import '@/app/api/v1/admin/central/churches/route'
import '@/app/api/v1/admin/central/churches/[churchId]/route'
import '@/app/api/v1/admin/central/churches/[churchId]/approve/route'
import '@/app/api/v1/admin/central/churches/[churchId]/suspend/route'
import '@/app/api/v1/admin/central/churches/[churchId]/archive/route'
import '@/app/api/v1/admin/central/churches/[churchId]/pastors/route'
import '@/app/api/v1/admin/central/countries/route'
import '@/app/api/v1/admin/central/countries/[code]/route'
import '@/app/api/v1/admin/central/languages/route'
import '@/app/api/v1/admin/central/languages/[code]/route'
import '@/app/api/v1/admin/central/hierarchy/route'
import '@/app/api/v1/admin/central/hierarchy/[nodeId]/route'
import '@/app/api/v1/admin/central/pastors/route'
import '@/app/api/v1/admin/central/pastors/[pastorId]/route'

// --- Global media upload (Phase 7 refactor: single /uploads API) ---
import '@/app/api/v1/uploads/route'
import '@/app/api/v1/uploads/[assetId]/complete/route'
import '@/app/api/v1/uploads/[assetId]/access/route'

// --- Voice submission + review (Phase 8) ---
import '@/app/api/v1/admin/me/voice-consents/route'
import '@/app/api/v1/admin/me/voice-submissions/route'
import '@/app/api/v1/admin/me/voice-submissions/[id]/route'
import '@/app/api/v1/admin/me/voice-submissions/[id]/submit/route'
import '@/app/api/v1/admin/central/voice-profiles/route'
import '@/app/api/v1/admin/central/voice-profiles/[voiceId]/route'
import '@/app/api/v1/admin/central/voice-profiles/[voiceId]/approve/route'
import '@/app/api/v1/admin/central/voice-profiles/[voiceId]/reject/route'

// --- Mobile shared backend (Phase 9 / Tasks 39-43) ---
import '@/app/api/v1/mobile/churches/route'
import '@/app/api/v1/mobile/churches/[churchId]/route'
import '@/app/api/v1/mobile/home/route'
import '@/app/api/v1/mobile/me/route'
import '@/app/api/v1/mobile/me/churches/route'
import '@/app/api/v1/mobile/me/avatar/route'
import '@/app/api/v1/mobile/me/follows/[churchId]/route'
import '@/app/api/v1/mobile/churches/[churchId]/prayers/route'
import '@/app/api/v1/mobile/prayers/[prayerId]/route'
import '@/app/api/v1/mobile/churches/[churchId]/events/route'
import '@/app/api/v1/mobile/churches/[churchId]/announcements/route'
import '@/app/api/v1/mobile/churches/[churchId]/requests/route'
import '@/app/api/v1/mobile/churches/[churchId]/check-ins/route'
import '@/app/api/v1/mobile/analytics-events/route'
import '@/app/api/v1/mobile/auth/login/route'
import '@/app/api/v1/mobile/auth/refresh/route'
import '@/app/api/v1/mobile/auth/logout/route'
import '@/app/api/v1/mobile/auth/forgot-password/route'
import '@/app/api/v1/mobile/auth/reset-password/route'

// --- Central: notification rules (Phase 10 / Task 44) ---
import '@/app/api/v1/admin/central/notification-rules/route'
