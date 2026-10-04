// The VAPID public key (the "application server key") that birthday reminder pushes are signed with.
// It isn't secret. scripts/make-vapid-keys.ts makes a new key pair, writes the public key here and
// into reminders/wrangler.jsonc, and the private key becomes the reminders Worker's secret.
// PLACEHOLDER: the rollout (Task 8 of the plan) replaces this key. Nobody holds its private half.
export const VAPID_PUBLIC_KEY = 'BLwNAu9O6nqiNKx-6lPlhLk_2LslupgmkvBGz6Bwlfhz_vvn0VFdgSSsRGSIr29QPqsN0r8M8ZOY9Emd_t619ig'
