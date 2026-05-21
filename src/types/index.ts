export interface Event {
  id: string
  name: string
  date: string
  location: string
  type: 'marathon' | 'granfondo' | 'cycling' | 'other'
  photo_count: number
  cover_image_url?: string
  drive_folder_id: string
  created_at: string
}

export interface Photo {
  id: string
  event_id: string
  file_name: string
  preview_url: string
  drive_file_id: string
  bib_number?: string
  participant_name?: string
  taken_at?: string
  thumbnail_url?: string
}

export interface UnlockRecord {
  id: string
  user_id: string
  photo_id: string
  order_number: string
  platform: 'naver' | 'coupang'
  verified: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  provider: 'google' | 'kakao'
}
