// 새 워커가 대기하지 않고 바로 적용되게 한다 (검증용이라 캐시가 없다)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  // waitUntil 안에서 알림을 띄우지 않으면 브라우저가 워커를 먼저 끝낼 수 있다
  event.waitUntil(
    self.registration.showNotification(data.title ?? "web-push-poc", {
      body: data.body,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => client.url === url);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
