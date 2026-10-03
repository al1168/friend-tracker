# Friend Tracker

A private iPhone app for remembering when you last saw your friends and how often you met this year vs last year. Everything stays on your phone.

## Use it on your iPhone

1. Open the app's GitHub Pages link in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the new **Friends** icon. Always use the icon: data entered in a Safari tab is stored separately.
4. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).

## Develop

    npm install
    npm run dev           # then open the printed URL (use the Network URL on your phone, same Wi-Fi)
    npm test              # unit tests
    npm run e2e           # end-to-end tests in WebKit at iPhone size
    npm run screenshots   # light/dark/large-text screenshots into e2e/screenshots/

Every push to `main` builds and publishes to GitHub Pages.
