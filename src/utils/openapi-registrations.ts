/*
 * Server-startup OpenAPI registrations (plan Task 8 / Phase 1).
 *
 * Each endpoint route module calls registerPath() at module scope. For those
 * paths to appear in GET /api/v1/openapi.json, this module must be imported
 * by the openapi.json route so the side-effect registrations run before
 * openApiDocument() is serialized.
 */

import '@/app/api/v1/admin/me/route'
import '@/app/api/v1/admin/access/route'
import '@/app/api/v1/users/route'
import '@/app/api/v1/users/[id]/route'
import '@/app/api/v1/roles/route'
import '@/app/api/v1/roles/[id]/route'
import '@/app/api/v1/permissions/route'
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
import '@/app/api/v1/admin/churches/[churchId]/requests/route'
import '@/app/api/v1/admin/churches/[churchId]/requests/[requestId]/route'
