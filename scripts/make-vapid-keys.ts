// Makes a new VAPID key pair for birthday reminders (see README.md, "Birthday reminders").
//
//   node scripts/make-vapid-keys.ts --out <file outside this repo>
//   node scripts/make-vapid-keys.ts --stdout | <a command that reads the key from its input>
//
// The public key goes into src/reminders/vapidKey.ts and reminders/wrangler.jsonc (commit both).
// The private key (a JWK) goes only where you send it: a new file outside this repo, or a pipe.
// It is never printed on the screen, and everything this script says goes to stderr.
// In Git Bash, --stdout can't tell a pipe from the screen, so use --out there.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const KEY_MODULE = resolve(root, 'src/reminders/vapidKey.ts')
const WRANGLER_CONFIG = resolve(root, 'reminders/wrangler.jsonc')

function fail(message: string): never {
  console.error(message)
  console.error('Usage: node scripts/make-vapid-keys.ts --out <file outside this repo>')
  console.error('   or: node scripts/make-vapid-keys.ts --stdout | <a command that reads the key>')
  process.exit(2)
}

const [mode, target] = process.argv.slice(2)
let outFile: string | null = null
if (mode === '--out') {
  if (!target) fail('--out needs a file path.')
  outFile = resolve(target)
  const fromRoot = relative(root, outFile)
  if (!fromRoot.startsWith('..') && !isAbsolute(fromRoot)) fail('The private key must not go inside the repo.')
  if (existsSync(outFile)) fail(`${outFile} already exists. Pick a new file.`)
} else if (mode === '--stdout') {
  if (process.stdout.isTTY) fail('--stdout only writes into a pipe, never onto the screen.')
} else {
  fail('Say where the private key goes.')
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))

const wrangler = readFileSync(WRANGLER_CONFIG, 'utf8')
const keyVar = /"VAPID_PUBLIC_KEY": "[^"]*"/
if (!keyVar.test(wrangler)) fail('reminders/wrangler.jsonc has no "VAPID_PUBLIC_KEY" var to update.')

// The private key first: if that fails, the public key in the repo is still the old one.
if (outFile) writeFileSync(outFile, privateJwk, { flag: 'wx', mode: 0o600 })
else process.stdout.write(privateJwk)

writeFileSync(
  KEY_MODULE,
  `// The VAPID public key (the "application server key") that birthday reminder pushes are signed with.
// It isn't secret. scripts/make-vapid-keys.ts made it and wrote the same key into reminders/wrangler.jsonc;
// its private half is the reminders Worker's VAPID_PRIVATE_KEY secret.
export const VAPID_PUBLIC_KEY = '${publicKey}'
`,
)
// The comment above the value says it's a placeholder until this script runs: it no longer is.
const placeholderNote = /\/\/ PLACEHOLDER until [^\r\n]*/
const keyNote = '// Written by scripts/make-vapid-keys.ts, with the same value as src/reminders/vapidKey.ts.'
writeFileSync(
  WRANGLER_CONFIG,
  wrangler.replace(keyVar, `"VAPID_PUBLIC_KEY": "${publicKey}"`).replace(placeholderNote, keyNote),
)

console.error(`New public key: ${publicKey}`)
console.error('Updated src/reminders/vapidKey.ts and reminders/wrangler.jsonc. Commit both.')
if (outFile) console.error(`The private key is in ${outFile}. Delete it once it's the Worker's secret.`)
