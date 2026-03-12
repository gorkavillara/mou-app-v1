import { prisma } from './prisma'

export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'PENDING' | 'EXPIRED'

export interface ConsentLog {
  id: string
  patientId: string
  status: ConsentStatus
  version: string
  acceptedAt: Date
  revokedAt?: Date | null
  ipAddress: string
  userAgent?: string | null
}

const CURRENT_VERSION = '1.0'
const CONSENT_EXPIRY_MONTHS = 12

export async function getConsentStatus(patientId: string): Promise<ConsentStatus> {
  const latestConsent = await prisma.consentLog.findFirst({
    where: { patientId },
    orderBy: { acceptedAt: 'desc' },
  })

  if (!latestConsent) {
    return 'PENDING'
  }

  if (latestConsent.status === 'REVOKED') {
    return 'REVOKED'
  }

  const expiryDate = new Date(latestConsent.acceptedAt)
  expiryDate.setMonth(expiryDate.getMonth() + CONSENT_EXPIRY_MONTHS)

  if (new Date() > expiryDate) {
    return 'EXPIRED'
  }

  return 'ACTIVE'
}

export async function recordConsent(
  patientId: string,
  userAgent: string,
  ipAddress: string
): Promise<ConsentLog> {
  const consent = await prisma.consentLog.create({
    data: {
      patientId,
      status: 'ACTIVE',
      version: CURRENT_VERSION,
      acceptedAt: new Date(),
      ipAddress,
      userAgent,
    },
  })

  return consent
}

export async function revokeConsent(
  patientId: string,
  userAgent: string,
  ipAddress: string
): Promise<ConsentLog> {
  const consent = await prisma.consentLog.create({
    data: {
      patientId,
      status: 'REVOKED',
      version: CURRENT_VERSION,
      acceptedAt: new Date(),
      revokedAt: new Date(),
      ipAddress,
      userAgent,
    },
  })

  return consent
}

export async function getConsentHistory(patientId: string): Promise<ConsentLog[]> {
  return prisma.consentLog.findMany({
    where: { patientId },
    orderBy: { acceptedAt: 'desc' },
  })
}
