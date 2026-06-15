self.addEventListener('push', event => {
  let payload = {
    title: '오켱사진링크게이트',
    body: '알림',
    url: '/mypage',
  }

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/window.svg',
      badge: '/window.svg',
      data: { url: payload.url || '/mypage' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const url = event.notification.data?.url || '/mypage'
  const targetUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
