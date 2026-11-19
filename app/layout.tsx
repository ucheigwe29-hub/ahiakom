import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Ahiakom — One Market. Endless Possibilities.",
  description:
    "Explore the Ahiakom marketplace development preview. Demonstration products, no live orders.",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06452F",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
