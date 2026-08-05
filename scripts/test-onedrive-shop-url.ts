/**
 * Manual: npx tsx scripts/test-onedrive-shop-url.ts
 * Optional: ONEDRIVE_SHOP_FILE_URL=https://1drv.ms/... npx tsx scripts/test-onedrive-shop-url.ts
 */
import {
  encodeOneDriveSharingUrl,
  toOneDriveSharesContentUrl,
  isOneDriveShareUrl,
  downloadOneDriveSharedFile,
} from '../src/lib/onedrive-shop-file'

const sample = 'https://1drv.ms/x/s!AqmFiI7maXrRgT7PGcK_7JyZlBco'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

async function main() {
  assert(isOneDriveShareUrl(sample), 'should detect 1drv.ms')
  const encoded = encodeOneDriveSharingUrl(sample)
  assert(encoded.startsWith('u!'), 'u! prefix')
  assert(!encoded.includes('+') && !encoded.includes('/') && !/=$/.test(encoded), 'url-safe b64')
  const contentUrl = toOneDriveSharesContentUrl(sample)
  assert(contentUrl.includes('/shares/u!') && contentUrl.endsWith('/root/content'), 'content path')
  console.log('encode ok:', contentUrl)

  const live = process.env.ONEDRIVE_SHOP_FILE_URL?.trim()
  if (live) {
    const result = await downloadOneDriveSharedFile(live)
    console.log('download ok:', {
      bytes: result.buffer.byteLength,
      contentType: result.contentType,
      fileNameHint: result.fileNameHint,
      finalUrl: result.finalUrl.slice(0, 120),
    })
  } else {
    console.log('skip live download (set ONEDRIVE_SHOP_FILE_URL to test)')
  }

  console.log('ok: onedrive shop url')
}

void main()
