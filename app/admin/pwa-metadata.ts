import type { Metadata, Viewport } from "next";

// Installable admin app: linked only from admin pages, never the public site.
export const adminPwaMetadata: Metadata = {
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "GH Admin", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/admin-180.png" },
};

export const adminViewport: Viewport = { themeColor: "#141210" };
