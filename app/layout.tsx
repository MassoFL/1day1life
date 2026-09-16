import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1day1life — Make today count",
  description:
    "A life is somehow a day. Track your daily intentions, one small action at a time.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
