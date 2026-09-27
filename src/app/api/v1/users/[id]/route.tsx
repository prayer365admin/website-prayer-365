import { updateUser } from '@/controller/user'
import { UserPayloadUpdateModel } from '@/models/user'
import { DELETE_USER, GET_USER_BY_ID } from '@/providers/user'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { NextRequest, NextResponse } from 'next/server'

type Params = Promise<{ id: string }>

export async function GET(req: NextRequest, segmentData: { params: Params }) {
  const {} = req.nextUrl.searchParams
  const params = await segmentData.params
  const id = params.id
  try {
    const { session, permission } = await requiredAuth(req)

    if (
      !permission.read('user_management_user').granted ||
      (session.user.user_id != id && !permission.readAny('user_management_user').granted)
    ) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await GET_USER_BY_ID({ user_id: id })
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
  const payload: UserPayloadUpdateModel = await req.json()
  const params = await segmentData.params
  const id = params.id
  try {
    const { session, permission } = await requiredAuth(req)

    if (
      !permission.update('user_management_user').granted ||
      (session.user.user_id != id && !permission.updateAny('user_management_user').granted)
    ) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await updateUser({ user_id: id, payload: payload })
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
    const { session, permission } = await requiredAuth(req)

    if (
      !permission.delete('user_management_user').granted ||
      (session.user.user_id != id && !permission.deleteAny('user_management_user').granted)
    ) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await DELETE_USER({ user_id: id })
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
