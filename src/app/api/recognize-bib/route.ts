import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  const { fileId } = await request.json()

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  }

  try {
    const accountId = process.env.CF_ACCOUNT_ID
    const apiToken = process.env.CF_API_TOKEN

    // 구글 서비스 계정으로 드라이브에서 이미지 가져오기
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
    const imageBuffer = Buffer.concat(chunks)
    console.log('이미지 크기(bytes):', imageBuffer.byteLength)

    const resized = await sharp(imageBuffer)
      .resize(512, 512, { fit: 'inside' })
      .png()
      .toBuffer()

    const uint8Array = Array.from(new Uint8Array(resized))

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/llava-hf/llava-1.5-7b-hf`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: uint8Array,
          prompt: '배번호 숫자만 답해줘',
          max_tokens: 50,
        }),
      }
    )

    const result = await response.json()
    console.log('Cloudflare 응답:', JSON.stringify(result))
    const fullText = result?.result?.description?.trim() || ''
    const numbers = fullText.match(/\b\d{3,4}\b/g) || []
    const uniqueNumbers = [...new Set(numbers)]

    return NextResponse.json({ bibNumbers: uniqueNumbers, fullText })
  } catch (error) {
    console.error('Cloudflare AI error:', error)
    return NextResponse.json({ error: 'OCR 실패' }, { status: 500 })
  }
}