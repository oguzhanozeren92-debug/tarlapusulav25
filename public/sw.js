self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'TarlaPusula',
      body: event.data
        ? event.data.text()
        : 'Yeni bir tarla hatırlatman var.',
    };
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'TarlaPusula',
      {
        body:
          data.body ||
          'Planladığın tarla işleminin zamanı geldi.',
        tag: data.tag || 'tarlapusula-reminder',
        renotify: true,
        data: {
          url: data.url || '/',
          reminderId: data.reminderId || null,
        },
      },
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        return clients.openWindow
          ? clients.openWindow(targetUrl)
          : undefined;
      }),
  );
});