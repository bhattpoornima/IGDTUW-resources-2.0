import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IGDTUW Resources",
  description: "Study resources for IGDTUW students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}