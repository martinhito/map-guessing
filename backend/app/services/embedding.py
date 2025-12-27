import httpx
from typing import List

from app.config import get_settings


class EmbeddingService:
    """OpenAI embedding client."""

    EMBEDDING_URL = "https://api.openai.com/v1/embeddings"

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=30.0)

    async def embed(self, text: str) -> List[float]:
        """Get embedding vector for text using OpenAI API."""
        response = await self.client.post(
            self.EMBEDDING_URL,
            headers={
                "Authorization": f"Bearer {self.settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.embedding_model,
                "input": text,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embedding vectors for multiple texts in a single API call."""
        if not texts:
            return []

        response = await self.client.post(
            self.EMBEDDING_URL,
            headers={
                "Authorization": f"Bearer {self.settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.embedding_model,
                "input": texts,
            },
        )
        response.raise_for_status()
        data = response.json()

        # Sort by index to maintain order
        sorted_data = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in sorted_data]

    async def close(self):
        await self.client.aclose()


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
