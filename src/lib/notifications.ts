export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function notify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: title })
  } catch {
    // Notification constructor can throw on some mobile browsers that require the service worker API instead.
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: '/icons/icon-192.png' }))
  }
}
