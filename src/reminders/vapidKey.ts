// The VAPID public key (the "application server key") that birthday reminder pushes are signed with.
// It isn't secret. scripts/make-vapid-keys.ts made it and wrote the same key into reminders/wrangler.jsonc;
// its private half is the reminders Worker's VAPID_PRIVATE_KEY secret.
export const VAPID_PUBLIC_KEY = 'BKZYt6cvQeLcvXG4WTLjFwFOaFHrpvRblPwqNG9yyQ4UJyDNPmufAq463rm5XVVLbWPwqp5o9AVtvFKbcUQru4o'
