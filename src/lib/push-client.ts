function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function ensurePushSubscription(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return false
  }

  const registration = await registerServiceWorker()
  if (!registration) return false

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return false

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
  }

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      },
    }),
  })

  return res.ok
}

export async function showPassNotification(title: string, body: string, url = '/mypage') {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(title, {
    body,
    icon: '/window.svg',
    badge: '/window.svg',
    data: { url },
  })
}
