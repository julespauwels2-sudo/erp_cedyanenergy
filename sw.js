// Service worker du QG : affiche les notifications importantes et ouvre la bonne page au toucher.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titre: "QG Cedyan", texte: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titre || "QG Cedyan", { body: d.texte || "", icon: "/icone-192.png", badge: "/icone-192.png", tag: d.tag || undefined, renotify: !!d.tag, data: { lien: d.lien || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const lien = (e.notification.data && e.notification.data.lien) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fen) => {
    for (const f of fen) if (f.url === lien && "focus" in f) return f.focus();
    return self.clients.openWindow(lien);
  }));
});
