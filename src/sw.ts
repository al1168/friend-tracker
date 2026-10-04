// The service worker. vite-plugin-pwa bundles this file into dist/sw.js and puts the list of
// files to keep offline in place of self.__WB_MANIFEST. It's type-checked by tsconfig.sw.json.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// A new version takes over as soon as it's installed; the app shows it the next time it's opened.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every page load is answered with the app, offline too, except the website's own pages and
// endpoints under /__ (sign-in, password check, reminders), which always go to the network.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__/] }))
