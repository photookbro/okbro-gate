import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildFollowerUploadJobPublicView,
  createInstagramFollowerUploadJob,
  getActiveInstagramFollowerUploadJob,
  getInstagramFollowerUploadJob,
  getLatestInstagramFollowerUploadJobs,
  processInstagramFollowerUploadJob,
  reconcileInstagramFollowerUploadJobs,
  resumeInstagramFollowerUploadPushes,
} from '@/lib/instagram-followers-upload-job-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Pro/Fluid 기준 — 백그라운드(after) 처리가 이 한도 안에서 끝나야 함 */
export const maxDuration = 300

/** 멈춘 작업 failed 처리 + 끊긴 푸시 발송 재개(백그라운드). 실패해도 조회는 계속 */
async function reconcileJobs(admin: SupabaseClient): Promise<void> {
  try {
    const { pushJobIds } = await reconcileInstagramFollowerUploadJobs(admin)
    if (pushJobIds.length > 0) {
      after(async () => {
        try {
          await resumeInstagramFollowerUploadPushes(admin, pushJobIds)
        } catch (error) {
          console.error('[admin/instagram-followers] resume push failed', pushJobIds, error)
        }
      })
    }
  } catch (error) {
    console.error('[admin/instagram-followers] reconcile failed', error)
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILE_COUNT = 20

function collectHtmlFiles(formData: FormData): File[] {
  const files: File[] = []
  for (const value of formData.getAll('file')) {
    if (value instanceof File && value.size > 0) files.push(value)
  }
  return files
}

/** 작업 테이블/컬럼이 아직 없을 때 관리자에게 보여줄 마이그레이션 안내 */
function missingMigrationMessage(
  error: { code?: string; message?: string } | null | undefined
): string | null {
  if (!error) return null
  if (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '')) {
    return '업로드 작업 테이블에 새 컬럼이 없어요. Supabase SQL Editor에서 마이그레이션 20260928_instagram_follower_upload_match_outbox.sql 을 실행해주세요.'
  }
  if (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /instagram_follower_upload_jobs/i.test(error.message ?? '')
  ) {
    return '업로드 작업 테이블이 없어요. Supabase SQL Editor에서 마이그레이션 20260907_instagram_follower_upload_jobs.sql 을 실행해주세요.'
  }
  return null
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const admin = supabaseAdmin()
  const jobId = new URL(req.url).searchParams.get('job_id')?.trim()

  await reconcileJobs(admin)

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
    const migrationMessage = missingMigrationMessage(error as { code?: string; message?: string })
    if (migrationMessage) {
      return NextResponse.json({ error: migrationMessage }, { status: 503 })
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

  const htmlTexts: string[] = []
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

    htmlTexts.push(html)
    fileNames.push(file.name)
  }

  const admin = supabaseAdmin()

  await reconcileJobs(admin)

  let job
  try {
    const active = await getActiveInstagramFollowerUploadJob(admin)
    if (active) {
      return NextResponse.json(
        {
          error: '이전 업로드가 아직 처리 중이에요. 완료되거나 실패로 표시된 뒤 다시 올려주세요.',
          job: buildFollowerUploadJobPublicView(active),
        },
        { status: 409 }
      )
    }

    // 파싱은 after()에서 — 요청은 접수만 빠르게 끝냄
    job = await createInstagramFollowerUploadJob(admin, {
      fileNames,
    })
  } catch (error) {
    const migrationMessage = missingMigrationMessage(error as { code?: string; message?: string })
    if (migrationMessage) {
      return NextResponse.json({ error: migrationMessage }, { status: 503 })
    }
    console.error('[admin/instagram-followers] create job', error)
    return NextResponse.json({ error: '업로드 접수에 실패했어요' }, { status: 500 })
  }

  // 콜백이 promise를 반환해야 waitUntil이 작업 종료까지 함수를 살려 둠
  after(async () => {
    try {
      await processInstagramFollowerUploadJob(admin, job.id, { htmlTexts })
    } catch (error) {
      console.error('[admin/instagram-followers] after() process failed', job.id, error)
      try {
        await admin
          .from('instagram_follower_upload_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : '백그라운드 처리 실패',
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .in('status', ['queued', 'processing'])
      } catch (updateError) {
        console.error('[admin/instagram-followers] fail update', updateError)
      }
    }
  })

  return NextResponse.json({
    success: true,
    accepted: true,
    message: '접수됐습니다. 백그라운드에서 분석·저장 중이에요.',
    job: buildFollowerUploadJobPublicView(job),
  })
}
