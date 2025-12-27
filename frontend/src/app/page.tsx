import { Metadata } from "next";
import GameClient from "./GameClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getPuzzleForMetadata() {
  try {
    const res = await fetch(`${API_URL}/api/puzzle`, {
      next: { revalidate: 60 }, // Revalidate every minute
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const puzzle = await getPuzzleForMetadata();

  const imageUrl = puzzle?.imageUrl || "https://canyouguessthemap.com/og-default.png";

  return {
    title: "Can You Guess the Map?",
    description: "A daily map guessing game - can you figure out what the map represents?",
    openGraph: {
      title: "Can You Guess the Map?",
      description: "A daily map guessing game",
      url: "https://canyouguessthemap.com",
      siteName: "Can You Guess the Map?",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 900,
          alt: "Today's Map Puzzle",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Can You Guess the Map?",
      description: "A daily map guessing game",
      images: [imageUrl],
    },
  };
}

export default function Page() {
  return <GameClient />;
}
