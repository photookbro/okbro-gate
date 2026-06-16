type AlbumAPreviewProps = {
  albumAUrl: string
}

function toEmbedUrl(url: string): string {
  if (url.includes('photos.google.com/share/') && !url.includes('/embed')) {
    return url.replace('/share/', '/share/embed/')
  }
  return url
}

export function AlbumAPreview({ albumAUrl }: AlbumAPreviewProps) {
  const embedUrl = toEmbedUrl(albumAUrl)

  return (
    <div className="album-a-preview">
      <iframe
        src={embedUrl}
        title="저화소 앨범 미리보기"
        className="album-a-preview-frame"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={albumAUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="album-a-preview-link"
      >
        새 탭에서 앨범 보기 →
      </a>
    </div>
  )
}
