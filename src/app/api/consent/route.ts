import { NextRequest, NextResponse } from 'next/server'
import { recordConsent, revokeConsent, getConsentStatus } from '@/lib/consent'
import { createClient } from '@/lib/supabase'

function getClientInfo(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return { ipAddress, userAgent }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const status = await getConsentStatus(patientId)

    return NextResponse.json({ status, patientId })
  } catch (error) {
    console.error('Error fetching consent status:', error)
    return NextResponse.json({ error: 'Failed to fetch consent status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    const consent = await recordConsent(patientId, userAgent, ipAddress)

    return NextResponse.json(consent, { status: 201 })
  } catch (error) {
    console.error('Error recording consent:', error)
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const { ipAddress, userAgent } = getClientInfo(request)

    const consent = await revokeConsent(patientId, userAgent, ipAddress)

    return NextResponse.json(consent)
  } catch (error) {
    console.error('Error revoking consent:', error)
    return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 })
  }
}
