import "@commerce-os/ui-system/globals.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Commerce OS Central Admin",
  description: "Gerçek auth, tenant provisioning ve runtime operasyon merkezi."
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
