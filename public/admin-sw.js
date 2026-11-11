// Golden Hour Admin service worker, registered with scope "/admin" (covers /admin and /admin/*).
// Push notifications only (no offline caching).

self.addEventListener("push", (event) => {
  let data = { title: "Golden Hour Admin", body: "", url: "/admin", tag: "admin" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: "/icons/admin-192.png",
      badge: "/icons/admin-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const admin = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      if (admin) {
        await admin.focus();
        try {
          return await admin.navigate(url);
        } catch {
          // navigate() only works on clients this worker controls; open a window instead.
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
