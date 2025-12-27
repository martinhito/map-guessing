import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Can You Guess the Map?",
  description: "A daily map guessing game - can you figure out what the map represents?",
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
