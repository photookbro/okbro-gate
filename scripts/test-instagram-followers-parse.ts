import assert from 'node:assert/strict'
import { parseInstagramFollowersFromHtml } from '../src/lib/instagram-followers-parse.ts'

const html = `
<a href="https://www.instagram.com/user_one">one</a>
<a href="https://instagram.com/user_two/">two</a>
<a href="https://www.instagram.com/explore/">skip</a>
<a href="https://www.instagram.com/user_one">dup</a>
`

const usernames = parseInstagramFollowersFromHtml(html)
assert.deepEqual(usernames, ['user_one', 'user_two'])
console.log('ok', usernames)
