/* Code Temple helper file (a "service worker").
   What it is for: the phone runs this file in the background. It saves a full copy of the
   game on the phone, then hands that saved copy back whenever the game is opened.
   That is what lets the game open with no internet.

   WHEN THE GAME FILES CHANGE: raise the number in GAME_VERSION by one.
   A new number tells the phone to throw out the old saved copy and save the new one. */

var GAME_VERSION = 1;
var CACHE_NAME = 'codeTempleV' + GAME_VERSION;          // name of the storage box on the phone

// every file the game needs. "./" is the plain web address of the game folder itself.
// The icon picture is written inside index.html, so the game page is the only file to store.
var FILES = ['./', './index.html'];

// FIRST RUN: download each file fresh from the internet and put it in the storage box
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(FILES.map(function (path) {
        // cache: 'reload' skips any stale copy the browser may be holding and asks the server for the real file
        return fetch(new Request(path, { cache: 'reload' })).then(function (response) {
          if (!response || !response.ok) throw new Error('Could not download ' + path);
          return cache.put(path, response);
        });
      }));
    }).then(function () {
      return self.skipWaiting();                            // start using this helper right away instead of waiting for a restart
    })
  );
});

// AFTER INSTALL: delete storage boxes left behind by older versions of the game, then take over open pages
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name.indexOf('codeTempleV') === 0 && name !== CACHE_NAME) return caches.delete(name);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// EVERY TIME THE GAME ASKS FOR A FILE: answer from the saved copy first, and only use the internet if the file is not saved
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;                                   // only plain file requests are handled
  if (new URL(request.url).origin !== self.location.origin) return;       // leave other web sites alone

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      // opening the game itself always gets the saved game page
      var lookup = (request.mode === 'navigate') ? cache.match('./index.html') : cache.match(request, { ignoreSearch: true });
      return lookup.then(function (saved) {
        if (saved) return saved;
        // not saved yet: try the internet, and keep a copy of whatever comes back
        return fetch(request).then(function (fresh) {
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        }).catch(function () {
          // no internet and no saved copy of this exact file: fall back to the saved game page
          return cache.match('./index.html').then(function (page) { return page || Response.error(); });
        });
      });
    })
  );
});
