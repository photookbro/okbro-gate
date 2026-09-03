import assert from 'node:assert/strict'
import {
  mergeInstagramFollowerUsernames,
  parseInstagramFollowersFromHtml,
} from '../src/lib/instagram-followers-parse.ts'

const html = `
<a href="https://www.instagram.com/user_one">one</a>
<a href="https://instagram.com/user_two/">two</a>
<a href="https://www.instagram.com/explore/">skip</a>
<a href="https://www.instagram.com/user_one">dup</a>
`

const usernames = parseInstagramFollowersFromHtml(html)
assert.deepEqual(usernames, ['user_one', 'user_two'])

const merged = mergeInstagramFollowerUsernames([
  parseInstagramFollowersFromHtml(
    `<a href="https://www.instagram.com/alpha">a</a><a href="https://www.instagram.com/Beta">b</a>`
  ),
  parseInstagramFollowersFromHtml(
    `<a href="https://www.instagram.com/beta">b2</a><a href="https://www.instagram.com/gamma">g</a>`
  ),
])
assert.deepEqual(merged, ['alpha', 'Beta', 'gamma'])

console.log('ok', { usernames, merged })
