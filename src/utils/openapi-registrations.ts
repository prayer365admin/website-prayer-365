/*
 * Server-startup OpenAPI registrations (plan Task 8 / Phase 1).
 *
 * Each endpoint route module calls registerPath() at module scope. For those
 * paths to appear in GET /api/v1/openapi.json, this module must be imported
 * by the openapi.json route so the side-effect registrations run before
 * openApiDocument() is serialized.
 */

// --- Staff identity + access (Phase 1) ---
import '@/app/api/v1/admin/me/route'
import '@/app/api/v1/admin/access/route'
import '@/app/api/v1/users/route'
import '@/app/api/v1/users/[id]/route'
import '@/app/api/v1/roles/route'
import '@/app/api/v1/roles/[id]/route'
import '@/app/api/v1/permissions/route'

// --- Church content: prayers / events / announcements (Phase 4) ---
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

// --- Sensitive requests (Phase 5) ---
import '@/app/api/v1/admin/churches/[churchId]/requests/route'
import '@/app/api/v1/admin/churches/[churchId]/requests/[requestId]/route'

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
import '@/app/api/v1/mobile/me/follows/[churchId]/route'
import '@/app/api/v1/mobile/churches/[churchId]/prayers/route'
import '@/app/api/v1/mobile/prayers/[prayerId]/route'
import '@/app/api/v1/mobile/churches/[churchId]/events/route'
import '@/app/api/v1/mobile/churches/[churchId]/announcements/route'
import '@/app/api/v1/mobile/churches/[churchId]/requests/route'
import '@/app/api/v1/mobile/churches/[churchId]/check-ins/route'
import '@/app/api/v1/mobile/analytics-events/route'

// --- Central: notification rules (Phase 10 / Task 44) ---
import '@/app/api/v1/admin/central/notification-rules/route'
