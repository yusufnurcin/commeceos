import "@commerce-os/ui-system/globals.css";
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Zyber Cart Commerce OS | Global Control Center",
  description: "Tenant izole, event-driven commerce operating system kontrol merkezi."
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
