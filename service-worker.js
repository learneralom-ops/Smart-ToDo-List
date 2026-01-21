// service-worker.js
const CACHE_NAME = 'smart-todo-pro-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/styles/dark-mode.css',
  '/styles/responsive.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/todo-manager.js',
  '/js/ai-features.js',
  '/js/notification.js',
  '/js/offline-sync.js',
  '/js/dashboard.js',
  '/js/ui-components.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Fallback for offline
        if (event.request.url.includes('/api/')) {
          return new Response(JSON.stringify({ 
            error: 'You are offline' 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // For HTML requests, return the cached index.html
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  const options = {
    body: event.data?.text() || 'নতুন নোটিফিকেশন',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'দেখুন',
        icon: '/icons/eye.png'
      },
      {
        action: 'close',
        title: 'বন্ধ করুন',
        icon: '/icons/close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Smart Todo Pro', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification click received.', event.notification.data);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(
      syncTasks()
        .then(() => {
          console.log('Background sync completed');
        })
        .catch(error => {
          console.error('Background sync failed:', error);
        })
    );
  }
});

async function syncTasks() {
  // Implementation for background sync
  // This would sync pending tasks with the server
  console.log('Syncing tasks in background...');
  
  // Get all pending sync items from IndexedDB
  // and sync them with Firebase
}