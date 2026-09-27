import { DELETE_ROLE, GET_ROLE_BY_ID, UPDATE_ROLE } from '@/providers/role'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { RoleType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

type Params = Promise<{ id: string }>
export async function GET(req: NextRequest, segmentData: { params: Params }) {
  const {} = req.nextUrl.searchParams
  const params = await segmentData.params
  const id = params.id

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

    const result = await GET_ROLE_BY_ID({ role_id: id })
    return NextResponse.json({
      success: true,
      message: `Successfully retrieve data with id ${id}!`,
      result: result,
    })
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}

export async function PUT(req: NextRequest, segmentData: { params: Params }) {
  const {} = req.nextUrl.searchParams
  const {
    name,
    permission_list,
    type,
  }: { name: string; permission_list: { [key: string]: boolean }; type: RoleType } =
    await req.json()
  const params = await segmentData.params
  const id = params.id
  try {
    const { permission } = await requiredAuth(req)

    if (!permission.updateAny('user_management_role').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await UPDATE_ROLE({
      role_id: id,
      name: name,
      permission_list: permission_list,
      type: type,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully update data with id ${id}!`,
      result: result,
    })
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}

export async function DELETE(req: NextRequest, segmentData: { params: Params }) {
  const {} = req.nextUrl.searchParams
  const params = await segmentData.params
  const id = params.id
  try {
    const { permission } = await requiredAuth(req)

    const result = await DELETE_ROLE({ role_id: id })

    if (!permission.deleteAny('user_management_role').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully delete data with id ${id}!`,
      result: result,
    })
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
