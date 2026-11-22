// 새 워커가 대기하지 않고 바로 적용되게 한다 (검증용이라 캐시가 없다)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const { title = "web-push-poc", options = {}, url = "/" } = event.data?.json() ?? {};
  // waitUntil 안에서 알림을 띄우지 않으면 브라우저가 워커를 먼저 끝낼 수 있다
  event.waitUntil(self.registration.showNotification(title, { ...options, data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  // 버튼을 눌렀으면 어느 버튼인지 페이지가 알 수 있게 주소에 붙인다
  if (event.action) target.searchParams.set("action", event.action);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        return open.navigate(target.href);
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
