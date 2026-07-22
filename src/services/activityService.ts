import { activityCatalog } from '@/data/mockData'
import { commit, db, nextId } from '@/data/db'
import { NotFoundError, respond } from '@/services/http'
import type { Activity, ActivityStatus, NewActivityPayload, ResidentId } from '@/types'

/** TODO: replace with real API call — GET /activities */
export function getAllActivities(): Promise<Activity[]> {
  return respond(db().activities)
}

/** TODO: replace with real API call — GET /activities?residentId= */
export function getActivitiesByResident(id: ResidentId): Promise<Activity[]> {
  return respond(db().activities.filter((activity) => activity.residentId === id))
}

/** TODO: replace with real API call — GET /activities/catalog */
export function getActivityCatalog(): Promise<string[]> {
  return respond(activityCatalog)
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — POST /activities */
export function bookActivity(payload: NewActivityPayload): Promise<Activity> {
  const created = commit((database) => {
    const activity: Activity = {
      ...payload,
      id: nextId('ACT', database.activities.length),
      status: 'booked',
    }
    database.activities.push(activity)
    return activity
  })

  return respond(created)
}

/** TODO: replace with real API call — PATCH /activities/:id */
export function updateActivityStatus(activityId: string, status: ActivityStatus): Promise<Activity> {
  const updated = commit((database) => {
    const activity = database.activities.find((row) => row.id === activityId)
    if (!activity) return null
    activity.status = status
    return activity
  })

  if (!updated) throw new NotFoundError('Aktivitas', activityId)
  return respond(updated)
}
