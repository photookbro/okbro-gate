import { NextRequest, NextResponse } from 'next/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'

const client = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
  },
})

export async function POST(request: NextRequest) {
  const { fileId } = await request.json()

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  }

  try {
    // 구글 드라이브 이미지 URL
    const imageUri = `https://drive.google.com/uc?id=${fileId}`

    const [result] = await client.textDetection(imageUri)
    const detections = result.textAnnotations

    if (!detections || detections.length === 0) {
      return NextResponse.json({ bibNumbers: [] })
    }

    // 숫자만 추출 (배번호는 보통 3-4자리 숫자)
    const fullText = detections[0].description || ''
    const numbers = fullText.match(/\b\d{3,4}\b/g) || []
    const uniqueNumbers = [...new Set(numbers)]

    return NextResponse.json({ bibNumbers: uniqueNumbers, fullText })
  } catch (error) {
    console.error('Vision API error:', error)
    return NextResponse.json({ error: 'Vision API 오류' }, { status: 500 })
  }
}