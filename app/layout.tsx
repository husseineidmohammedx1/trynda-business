import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trynda Business",
    template: "%s | Trynda Business",
  },

  description: "Trynda Business Management System",

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
    <html lang="en" suppressHydrationWarning>
      <body className="trynda-app">
        <div className="trynda-background">
          <div className="trynda-glow trynda-glow-1" />
          <div className="trynda-glow trynda-glow-2" />
          <div className="trynda-grid" />
        </div>

        <main className="trynda-root">{children}</main>
      </body>
    </html>
  );
}