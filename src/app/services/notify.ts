const ICON = 'icons/icon-192.png';

/**
 * Shows a system notification. Goes through the service worker when one is registered (the only
 * way that works on Android), otherwise uses the page's own Notification API. A notification
 * replaces an earlier one with the same `tag`.
 */
export async function showNotification(title: string, body: string, tag: string): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  const options: NotificationOptions = { body, icon: ICON, tag };
  if (registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}
