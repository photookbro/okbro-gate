import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function ocrImage(fileId: string): Promise<string> {
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
  const resized = await sharp(imageBuffer)
    .resize(512, 512, { fit: 'inside' })
    .png()
    .toBuffer()
  const uint8Array = Array.from(new Uint8Array(resized))

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/llava-hf/llava-1.5-7b-hf`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: uint8Array,
        prompt: '이 이미지에서 마라톤 또는 사이클 대회 배번호 숫자만 답해줘. 숫자만.',
        max_tokens: 50,
      }),
    }
  )
  const result = await response.json()
  return result?.result?.description?.trim() || ''
}

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

    // 이벤트에서 drive_folder_id 가져오기
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!event?.drive_folder_id) {
      return NextResponse.json({ error: 'drive_folder_id 없음' }, { status: 400 })
    }

    // 드라이브 폴더에서 이미지 목록 가져오기
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
    const drive = google.drive({ version: 'v3', auth })
    const fileList = await drive.files.list({
      q: `'${event.drive_folder_id}' in parents and mimeType contains 'image/'`,
      fields: 'files(id, name)',
    })

    const files = fileList.data.files || []
    console.log(`폴더에서 ${files.length}개 이미지 발견`)

    // 이미 처리된 파일 목록
    const { data: existing } = await supabase
      .from('photos')
      .select('drive_file_id')
      .eq('event_id', eventId)

    const existingIds = new Set(existing?.map(p => p.drive_file_id) || [])

    let added = 0
    for (const file of files) {
      if (!file.id || existingIds.has(file.id)) continue

      try {
        const fullText = await ocrImage(file.id)
        const numbers = fullText.match(/\b\d{3,5}\b/g) || []
        const bibNumber = numbers[0] || null
        console.log(`${file.name}: OCR="${fullText}", bib=${bibNumber}`)

        await supabase.from('photos').insert({
          event_id: eventId,
          file_name: file.name,
          drive_file_id: file.id,
          bib_number: bibNumber,
          preview_url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`,
        })
        added++
      } catch (e) {
        console.error(`${file.name} 처리 실패:`, e)
      }
    }

    return NextResponse.json({ success: true, total: files.length, added })
  } catch (error) {
    console.error('sync error:', error)
    return NextResponse.json({ error: '동기화 실패' }, { status: 500 })
  }
}