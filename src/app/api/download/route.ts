import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedUser } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  }

  // 로그인 확인
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 구글 드라이브에서 파일 다운로드
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  const drive = google.drive({ version: 'v3', auth })

  const file = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  )

  const chunks: Buffer[] = []
  await new Promise((resolve, reject) => {
    file.data.on('data', (chunk: Buffer) => chunks.push(chunk))
    file.data.on('end', resolve)
    file.data.on('error', reject)
  })

  const buffer = Buffer.concat(chunks)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${fileId}.jpg"`,
    },
  })
}
