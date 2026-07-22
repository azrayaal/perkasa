import { commit, db, nextId } from '@/data/db'
import { NotFoundError, respond } from '@/services/http'
import type { FamilyMember, NewFamilyMemberPayload, ResidentId } from '@/types'

/** TODO: replace with real API call — GET /family-members */
export function getAllFamilyMembers(): Promise<FamilyMember[]> {
  return respond(db().familyMembers)
}

/** TODO: replace with real API call — GET /family-members?residentId= */
export function getFamilyMembersByResident(id: ResidentId): Promise<FamilyMember[]> {
  return respond(db().familyMembers.filter((member) => member.residentId === id))
}

/* -------------------------------------------------------------------------- */
/* Aksi                                                                        */
/* -------------------------------------------------------------------------- */

/** TODO: replace with real API call — POST /family-members */
export function inviteFamilyMember(payload: NewFamilyMemberPayload): Promise<FamilyMember> {
  const created = commit((database) => {
    const member: FamilyMember = { ...payload, id: nextId('F', database.familyMembers.length) }
    database.familyMembers.push(member)
    return member
  })

  return respond(created)
}

/** TODO: replace with real API call — PATCH /family-members/:id */
export function setFamilyPortalAccess(memberId: string, portalAccess: boolean): Promise<FamilyMember> {
  const updated = commit((database) => {
    const member = database.familyMembers.find((row) => row.id === memberId)
    if (!member) return null
    member.portalAccess = portalAccess
    return member
  })

  if (!updated) throw new NotFoundError('Anggota keluarga', memberId)
  return respond(updated)
}
