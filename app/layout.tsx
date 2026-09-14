import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./language-provider";

export const metadata: Metadata = {
  title: {
    default: "Trynda Business",
    template: "%s | Trynda Business",
  },

  description: "نظام إدارة أعمال Trynda",

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="ltr" suppressHydrationWarning>
      <body className="trynda-app">
        <div className="trynda-background">
          <div className="trynda-glow trynda-glow-1" />
          <div className="trynda-glow trynda-glow-2" />
          <div className="trynda-grid" />
        </div>

        <LanguageProvider>
          <main className="trynda-root">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}