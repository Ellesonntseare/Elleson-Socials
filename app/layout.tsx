import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elleson Socials",
  description: "Plan and save your social content across devices.",
  icons: {
    icon: "/planner/icon.svg",
    shortcut: "/planner/icon.svg",
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
