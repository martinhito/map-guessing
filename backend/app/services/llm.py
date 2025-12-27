import asyncio
import httpx
import json

from app.config import get_settings


class LLMService:
    """OpenAI chat completion client for generating synonyms."""

    CHAT_URL = "https://api.openai.com/v1/chat/completions"
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds

    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate_synonyms(self, answer: str, count: int = 10) -> list[str]:
        """Generate synonym phrases for an answer using GPT."""
        prompt = f"""Given this description of what a map shows: "{answer}"

Generate {count} alternative ways someone might describe the same thing. Include a variety of:
- Formal and informal phrasings
- Short and detailed descriptions
- Technical and layman's terms
- Different word orders and sentence structures

The goal is to match how different people might describe the same map.

Return ONLY a JSON array of strings, nothing else. Example:
["phrase 1", "phrase 2", "phrase 3"]"""

        last_error = None
        for attempt in range(self.MAX_RETRIES):
            try:
                response = await self.client.post(
                    self.CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,
                    },
                )
                response.raise_for_status()
                data = response.json()
                break
            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code == 429:
                    # Rate limited - wait and retry
                    wait_time = self.RETRY_DELAY * (attempt + 1)
                    print(f"Rate limited, waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                else:
                    # Non-retryable error - return empty list instead of failing
                    print(f"LLM error: {e}")
                    return []
            except Exception as e:
                print(f"LLM error: {e}")
                return []
        else:
            # All retries failed - return empty instead of raising
            print(f"LLM failed after {self.MAX_RETRIES} retries")
            return []

        content = data["choices"][0]["message"]["content"].strip()

        # Parse JSON array from response
        try:
            synonyms = json.loads(content)
            if isinstance(synonyms, list):
                return [str(s) for s in synonyms[:count]]
        except json.JSONDecodeError:
            pass

        return []

    async def close(self):
        await self.client.aclose()


# Singleton instance
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
