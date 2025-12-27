import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Map Guessing - Daily Map Puzzle",
  description: "Guess what the map represents in this daily puzzle game",
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
