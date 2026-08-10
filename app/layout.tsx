import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "GitHub Today",
  title: {
    default: "GitHub Today",
    template: "%s · GitHub Today"
  },
  description: "每日 GitHub Trending 中文阅读",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GitHub Today",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#24292f",
  colorScheme: "light",
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
