import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  mergeInstagramFollowerUsernames,
  parseInstagramFollowersFromHtml,
} from '@/lib/instagram-followers-parse'
import {
  buildFollowerUploadJobPublicView,
  createInstagramFollowerUploadJob,
  getInstagramFollowerUploadJob,
  getLatestInstagramFollowerUploadJobs,
  processInstagramFollowerUploadJob,
} from '@/lib/instagram-followers-upload-job-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Pro/Fluid 기준 — 백그라운드(after) 처리가 이 한도 안에서 끝나야 함 */
export const maxDuration = 300

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILE_COUNT = 20

function collectHtmlFiles(formData: FormData): File[] {
  const files: File[] = []
  for (const value of formData.getAll('file')) {
    if (value instanceof File && value.size > 0) files.push(value)
  }
  return files
}

function isMissingJobsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /instagram_follower_upload_jobs/i.test(error.message ?? '')
  )
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const admin = supabaseAdmin()
  const jobId = new URL(req.url).searchParams.get('job_id')?.trim()

  try {
    if (jobId) {
      const job = await getInstagramFollowerUploadJob(admin, jobId)
      if (!job) {
        return NextResponse.json({ error: '작업을 찾지 못했어요' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        job: buildFollowerUploadJobPublicView(job),
      })
    }

    const jobs = await getLatestInstagramFollowerUploadJobs(admin, 5)
    return NextResponse.json({
      success: true,
      jobs: jobs.map(buildFollowerUploadJobPublicView),
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (isMissingJobsTable(err)) {
      return NextResponse.json(
        {
          error:
            '업로드 작업 테이블이 없어요. Supabase SQL Editor에서 마이그레이션 20260907_instagram_follower_upload_jobs.sql 을 실행해주세요.',
        },
        { status: 503 }
      )
    }
    console.error('[admin/instagram-followers] GET', error)
    return NextResponse.json({ error: '작업 상태 조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
  }

  const files = collectHtmlFiles(formData)
  if (files.length === 0) {
    return NextResponse.json({ error: 'HTML 파일을 선택해주세요' }, { status: 400 })
  }
  if (files.length > MAX_FILE_COUNT) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_FILE_COUNT}개까지 업로드할 수 있어요` },
      { status: 400 }
    )
  }

  const parsedLists: string[][] = []
  const fileNames: string[] = []

  for (const file of files) {
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.html') && file.type !== 'text/html') {
      return NextResponse.json(
        { error: `HTML 파일(.html)만 업로드할 수 있어요: ${file.name}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `파일 크기는 25MB 이하여야 해요: ${file.name}` },
        { status: 400 }
      )
    }

    let html: string
    try {
      html = await file.text()
    } catch {
      return NextResponse.json(
        { error: `파일 내용을 읽지 못했어요: ${file.name}` },
        { status: 400 }
      )
    }

    parsedLists.push(parseInstagramFollowersFromHtml(html))
    fileNames.push(file.name)
  }

  const parsedUsernames = mergeInstagramFollowerUsernames(parsedLists)
  if (parsedUsernames.length === 0) {
    return NextResponse.json({ error: '팔로워 아이디를 찾지 못했어요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  let job
  try {
    job = await createInstagramFollowerUploadJob(admin, {
      fileNames,
      usernames: parsedUsernames,
    })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (isMissingJobsTable(err)) {
      return NextResponse.json(
        {
          error:
            '업로드 작업 테이블이 없어요. Supabase SQL Editor에서 마이그레이션 20260907_instagram_follower_upload_jobs.sql 을 실행해주세요.',
        },
        { status: 503 }
      )
    }
    console.error('[admin/instagram-followers] create job', error)
    return NextResponse.json({ error: '업로드 접수에 실패했어요' }, { status: 500 })
  }

  after(() => {
    void processInstagramFollowerUploadJob(admin, job.id)
  })

  return NextResponse.json({
    success: true,
    accepted: true,
    message: '접수됐습니다. 백그라운드에서 분석·저장 중이에요.',
    job: buildFollowerUploadJobPublicView(job),
  })
}
