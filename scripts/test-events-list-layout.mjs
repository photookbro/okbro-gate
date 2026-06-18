import assert from 'node:assert/strict'
import {
  EVENTS_PAST_SECTION_SUB_MAIN,
  EVENTS_PAST_SECTION_SUB_TAIL,
  EVENTS_UPCOMING_ON_DETAIL,
  EVENTS_UPCOMING_ON_PROMPT,
  EVENTS_UPCOMING_SECTION_TITLE,
  formatEventDateDisplay,
  formatPastEventHeading,
  formatPastShootRecordLine,
  GPS_SHOOT_RECORD_DISCLAIMER,
  parseEventsListResponse,
  parseShootRecord,
} from '../src/lib/events-list-client.ts'

assert.equal(EVENTS_UPCOMING_SECTION_TITLE, '📅 오켱 출사 예정')
assert.equal(EVENTS_UPCOMING_ON_PROMPT, '참가 예정이면 ON으로 해주세요')
assert.ok(EVENTS_UPCOMING_ON_DETAIL.includes('오켱 카메라 앞에'))
assert.equal(EVENTS_PAST_SECTION_SUB_MAIN, '고화소 사진 UPLOAD 완료된 대회')
assert.equal(EVENTS_PAST_SECTION_SUB_TAIL, '최근 12개월')

assert.equal(formatEventDateDisplay('2026-06-08'), '2026.06.08')
assert.equal(formatEventDateDisplay('2026-06-08T00:00:00'), '2026.06.08')
assert.equal(formatPastEventHeading('강릉자전거', '2026-06-08', false), '⏳ 2026.06.08 강릉자전거')
assert.equal(formatPastEventHeading('홍천그란폰도', '2025-09-14', true), '📸 2025.09.14 홍천그란폰도')

assert.deepEqual(parseShootRecord({ username: 'kospilee', time: '14:32' }), {
  username: 'kospilee',
  time: '14:32',
})
assert.equal(parseShootRecord({ username: '', time: '14:32' }), null)
assert.equal(parseShootRecord(null), null)

assert.equal(
  formatPastShootRecordLine({ username: 'kospilee', time: '14:32' }),
  'kospilee님은 14:32경에 오켱 카메라 앞을 지나갔습니다'
)
assert.ok(!GPS_SHOOT_RECORD_DISCLAIMER.startsWith('('))
assert.ok(!GPS_SHOOT_RECORD_DISCLAIMER.endsWith(')'))
assert.ok(GPS_SHOOT_RECORD_DISCLAIMER.includes('GPS 오차'))

const parsed = parseEventsListResponse({
  past: [
    {
      id: 'p1',
      name: '강릉자전거',
      date: '2026-06-08',
      shoot_record: { username: 'kospilee', time: '14:32' },
    },
    {
      id: 'p2',
      name: '무효',
      date: '2026-06-09',
      shoot_record: { username: '', time: '14:32' },
    },
  ],
  upcoming: [
    {
      id: 'u1',
      name: '강릉마라톤',
      date: '2026-09-15',
      gps_enabled: false,
      locations: [{ location_number: 1 }],
    },
    {
      id: 'u2',
      name: 'GPS없음',
      date: '2026-10-01',
      gps_enabled: false,
      locations: [],
    },
  ],
})

assert.equal(parsed.past.length, 2)
assert.deepEqual(parsed.past[0]?.shoot_record, { username: 'kospilee', time: '14:32' })
assert.equal(parsed.past[1]?.shoot_record, null)

assert.equal(parsed.upcoming[0]?.show_gps_toggle, true)
assert.equal(parsed.upcoming[1]?.show_gps_toggle, false)
assert.equal(formatEventDateDisplay(parsed.upcoming[0]?.date ?? ''), '2026.09.15')

console.log('events-list-client parse/render tests passed')
