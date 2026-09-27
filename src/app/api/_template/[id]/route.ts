import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { NextRequest, NextResponse } from 'next/server'

type Params = Promise<{ id: string }>
export async function GET(req: NextRequest, segmentData: { params: Params }) {
  const {} = req.nextUrl.searchParams
  const params = await segmentData.params
  const id = params.id
  try {
    await requiredAuth(req)
    // Action here
    const result = 'PUT YOUR RESULT HERE!'
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
  const {} = await req.json()
  const params = await segmentData.params
  const id = params.id
  try {
    await requiredAuth(req)
    // Action here
    const result = 'PUT YOUR RESULT HERE!'
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

export async function DELETE(_req: NextRequest, segmentData: { params: Params }) {
  const params = await segmentData.params
  const id = params.id

  try {
    await requiredAuth(_req)
    // Action here
    const result = 'PUT YOUR RESULT HERE!'
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
