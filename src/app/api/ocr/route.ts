import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { fileId } = await request.json()

  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 })
  }

  try {
    const accountId = process.env.CF_ACCOUNT_ID
    const apiToken = process.env.CF_API_TOKEN

    // 구글 드라이브에서 이미지 가져오기
    const imageUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
    const imageRes = await fetch(imageUrl)
    const arrayBuffer = await imageRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Cloudflare Workers AI로 OCR
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/llava-hf/llava-1.5-7b-hf`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          prompt: '이 이미지에서 마라톤 또는 사이클 대회 배번호(숫자)만 읽어서 숫자만 답해줘. 숫자 외에 다른 말은 하지 마.',
          max_tokens: 50,
        }),
      }
    )

    const result = await response.json()
    const fullText = result?.result?.description?.trim() || ''
    const numbers = fullText.match(/\b\d{3,4}\b/g) || []
    const uniqueNumbers = [...new Set(numbers)]

    return NextResponse.json({ bibNumbers: uniqueNumbers, fullText })
  } catch (error) {
    console.error('Cloudflare AI error:', error)
    return NextResponse.json({ error: 'OCR 실패' }, { status: 500 })
  }
}