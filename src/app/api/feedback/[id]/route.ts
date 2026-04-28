import { NextRequest, NextResponse } from 'next/server'
import { getFeedbackHtml } from '@/lib/sheets'
import { createZipBlob } from '@/lib/zip'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const html = await getFeedbackHtml(id)
  if (!html) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filename = `feedback_${id.slice(0, 8)}.html`
  const zipName = `feedback_${id.slice(0, 8)}.zip`

  const blob = createZipBlob([{ name: filename, content: html }])
  const buffer = Buffer.from(await blob.arrayBuffer())

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
    },
  })
}
