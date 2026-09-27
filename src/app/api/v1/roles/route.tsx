import { RolePayloadCrateModel } from '@/models/role'
import { CREATE_ROLE, GET_ROLES } from '@/providers/role'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { RoleType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const type = searchParams.get('type') ? (searchParams.get('type') as RoleType) : undefined

  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('user_management_role').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await GET_ROLES({ type: type })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully get all role!',
        result: result,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}

export async function POST(req: NextRequest) {
  const payload: RolePayloadCrateModel = await req.json()

  try {
    const { permission } = await requiredAuth(req)

    if (!permission.createAny('user_management_role').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await CREATE_ROLE({ ...payload, permission_list: undefined })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully create new role!',
        result: result,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
