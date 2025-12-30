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
- Abbreviation variations (e.g., "U.S." vs "US" vs "United States", "GDP" vs "Gross Domestic Product")
- Singular vs plural forms
- With and without articles ("the", "a")

The goal is to match how different people might describe the same map. Be creative with phrasing variations.

Return ONLY a JSON array of lowercase strings, nothing else. Example:
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
                return [str(s).lower() for s in synonyms[:count]]
        except json.JSONDecodeError:
            pass

        return []

    async def check_guess_match(self, answer: str, guess: str, variants: list[str] | None = None) -> tuple[bool, float]:
        """
        Check if a guess matches the answer using GPT-4o-mini.
        Returns (is_correct, confidence) where confidence is 0.0-1.0.
        """
        variants_text = ""
        if variants:
            variants_text = f"\nAcceptable alternative phrasings: {', '.join(variants)}"

        prompt = f"""You are evaluating whether a user's guess correctly identifies what a map is showing.

The correct answer is: "{answer}"{variants_text}

The user guessed: "{guess}"

The guess must capture the COMPLETE concept shown on the map, not just a partial keyword.

Be lenient with:
- Different word orders
- Singular vs plural
- Minor spelling errors
- Abbreviations vs full words
- Articles (the, a, an)
- Synonymous terms (e.g., "production" vs "output")

Be STRICT about:
- The guess must include the full concept, not just a keyword (e.g., if the answer is "beef production", just "beef" is NOT correct - they need to mention production/output/etc.)
- The actual subject matter (e.g., "income" vs "population" are different)
- Geographic scope if specified (e.g., "US" vs "world" are different)
- The type of data (e.g., "median" vs "average" vs "total" matter)
- What is being measured (e.g., "forest coverage" vs just "forests", "population density" vs just "population")

The user should demonstrate they understand what data/metric the map is displaying, not just recognize a topic.

Respond with JSON only."""

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
                    "temperature": 0,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "guess_evaluation",
                            "strict": True,
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "is_correct": {
                                        "type": "boolean",
                                        "description": "Whether the guess correctly identifies what the map shows"
                                    },
                                    "confidence": {
                                        "type": "number",
                                        "description": "Confidence score from 0.0 to 1.0 indicating how close the guess is"
                                    },
                                    "reasoning": {
                                        "type": "string",
                                        "description": "Brief explanation of the evaluation"
                                    }
                                },
                                "required": ["is_correct", "confidence", "reasoning"],
                                "additionalProperties": False
                            }
                        }
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            result = json.loads(content)

            is_correct = result.get("is_correct", False)
            confidence = float(result.get("confidence", 0.0))

            # Clamp confidence to 0-1 range
            confidence = max(0.0, min(1.0, confidence))

            return (is_correct, confidence)

        except Exception as e:
            print(f"LLM guess check error: {e}")
            # On error, return not correct with 0 confidence
            return (False, 0.0)

    async def close(self):
        await self.client.aclose()


# Singleton instance
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
