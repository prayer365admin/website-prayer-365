import { GeneralError } from '@/utils/general-error'
import {
  CREATE_ANNOUNCEMENT,
  DELETE_ANNOUNCEMENT,
  GET_ANNOUNCEMENT,
  GET_ANNOUNCEMENT_IN_SCOPE,
  LIST_ANNOUNCEMENTS,
  PUBLISH_ANNOUNCEMENT,
  UNPUBLISH_ANNOUNCEMENT,
  UPDATE_ANNOUNCEMENT,
} from '@/providers/announcement'
import {
  AnnouncementInput,
  AnnouncementListItem,
  AnnouncementListQuery,
  AnnouncementOutput,
  AnnouncementPublishInput,
} from '@/models/announcement'

/*
 * Announcement business logic (Task 27, D12 minimal fields). No arbitrary
 * schedule — publish always sets published_at = now. version gates PATCH and
 * publish (409 when stale).
 */

const scopeError = () =>
  new GeneralError({
    code: 403,
    error: 'UNAUTHORIZED',
    error_code: 'NOT_ALLOWED',
    details: 'This account is not allowed for this church.',
  })
const notFound = () =>
  new GeneralError({
    code: 404,
    error: 'NOT_FOUND',
    error_code: 'RESOURCE_NOT_FOUND',
    details: 'Announcement not found.',
  })
const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This announcement has changed. Refresh and try again.',
  })

export const listAnnouncements = async ({
  churchIds,
  query,
}: {
  churchIds: Set<string>
  query: AnnouncementListQuery
}): Promise<{ result: AnnouncementListItem[]; total: number }> =>
  LIST_ANNOUNCEMENTS({ churchIds, query })

export const getAnnouncementInScope = async ({
  churchIds,
  announcementId,
}: {
  churchIds: Set<string>
  announcementId: string
}): Promise<AnnouncementListItem> => {
  const announcement = await GET_ANNOUNCEMENT_IN_SCOPE({ churchIds, announcementId })
  if (!announcement) throw notFound()
  return announcement
}

export const createAnnouncement = async ({
  userId,
  churchId,
  churchIds,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  input: AnnouncementInput
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  return CREATE_ANNOUNCEMENT({ churchId, data: input, actorId: userId, requestId })
}

export const patchAnnouncement = async ({
  userId,
  churchId,
  churchIds,
  announcementId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  announcementId: string
  input: AnnouncementInput
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  if (!input.version)
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'VERSION_REQUIRED',
      details: 'version is required to edit an announcement.',
    })
  const current = await GET_ANNOUNCEMENT({ churchId, churchIds, announcementId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  return UPDATE_ANNOUNCEMENT({
    churchId,
    churchIds,
    announcementId,
    expectedVersion: input.version,
    data: input,
    actorId: userId,
    requestId,
  })
}

export const publishAnnouncement = async ({
  userId,
  churchId,
  churchIds,
  announcementId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  announcementId: string
  input: AnnouncementPublishInput
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const current = await GET_ANNOUNCEMENT({ churchId, churchIds, announcementId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  return PUBLISH_ANNOUNCEMENT({
    churchId,
    churchIds,
    announcementId,
    expectedVersion: input.version,
    actorId: userId,
    requestId,
  })
}

export const deleteAnnouncement = async ({
  userId,
  churchId,
  churchIds,
  announcementId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  announcementId: string
  input: AnnouncementPublishInput
  requestId: string
}): Promise<void> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const current = await GET_ANNOUNCEMENT({ churchId, churchIds, announcementId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  await DELETE_ANNOUNCEMENT({
    churchId,
    churchIds,
    announcementId,
    expectedVersion: input.version,
    actorId: userId,
    requestId,
  })
}

export const unpublishAnnouncement = async ({
  userId,
  churchId,
  churchIds,
  announcementId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  announcementId: string
  input: AnnouncementPublishInput
  requestId: string
}): Promise<AnnouncementOutput> => {
  if (!churchIds.has(churchId)) throw scopeError()
  const current = await GET_ANNOUNCEMENT({ churchId, churchIds, announcementId })
  if (!current) throw notFound()
  if (input.version !== current.version) throw stale()
  return UNPUBLISH_ANNOUNCEMENT({
    churchId,
    churchIds,
    announcementId,
    expectedVersion: input.version,
    actorId: userId,
    requestId,
  })
}
