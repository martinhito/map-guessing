#!/usr/bin/env python3
"""
Generate guided hints for all puzzles that don't have them yet.

Uses GPT-4o-mini to analyze each puzzle's answer and create trigger-based hints
that fire when a player is close but can't nail the exact phrasing.

Usage:
    export OPENAI_API_KEY="..."
    export AWS_ACCESS_KEY_ID="..."
    export AWS_SECRET_ACCESS_KEY="..."
    python3 scripts/generate_guided_hints.py [--dry-run] [--puzzle-id YYYY-MM-DD]
"""

import argparse
import json
import os
import sys
import time

import boto3
import httpx

S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "map-puzzles")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-2")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are helping design a word-guessing game where players see a choropleth map and try to guess what statistic it shows.

Given the answer to a puzzle, generate 2-4 "guided hints" that trigger when a player's guess is close but not quite right. Each guided hint has:

1. triggerWords: 3-6 keywords that indicate the player is thinking in the right direction. These are checked as case-insensitive substrings of the guess.
2. similarityRange: [min, max] between 0.0 and 1.0. The hint only fires if the player's semantic similarity score falls in this range. Use wider ranges for vaguer hints and narrower ranges for more specific ones.
3. hint: A helpful nudge that steers them toward the correct answer WITHOUT giving it away. Be conversational and encouraging. Point out what they got right and what's missing.
4. priority: Integer 1-4 (1 = most specific/best match, shown first if multiple trigger).

Guidelines:
- Priority 1: Player identified the core topic but wrong measurement (e.g., guessed "nuclear energy" for "share of electricity from nuclear")
- Priority 2: Player identified the broad category but wrong specific topic (e.g., guessed "renewable energy" for "share of electricity from nuclear")  
- Priority 3: Player identified a related concept (e.g., guessed "electricity" for "share of electricity from nuclear")
- Not every puzzle needs all 4 priorities. 2-3 is fine.
- Hints should NOT reveal the answer. They should redirect thinking.
- triggerWords should be lowercase single words, not phrases.

Return ONLY a JSON array of guided hint objects. No markdown, no explanation."""

USER_PROMPT_TEMPLATE = """Puzzle answer: "{answer}"

The puzzle also has these synonyms/variants that are accepted as correct:
{synonyms}

Generate guided hints for near-miss guesses."""


def generate_hints_for_puzzle(answer: str, synonyms: list[str]) -> list[dict]:
    """Call Claude Sonnet to generate guided hints."""
    synonym_text = "\n".join(f"- {s}" for s in synonyms) if synonyms else "(no synonyms defined)"
    
    user_content = USER_PROMPT_TEMPLATE.format(answer=answer, synonyms=synonym_text)
    
    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "system": SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": user_content},
            ],
        },
        timeout=30.0,
    )
    response.raise_for_status()
    
    content = response.json()["content"][0]["text"]
    
    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]  # remove first line
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
    
    parsed = json.loads(content)
    
    # Handle both {"guidedHints": [...]} and [...] formats
    if isinstance(parsed, list):
        return parsed
    elif isinstance(parsed, dict) and "guidedHints" in parsed:
        return parsed["guidedHints"]
    elif isinstance(parsed, dict) and "hints" in parsed:
        return parsed["hints"]
    else:
        # Try to find an array value
        for v in parsed.values():
            if isinstance(v, list):
                return v
        raise ValueError(f"Unexpected response format: {content[:200]}")


def get_s3_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def get_puzzle(s3_client, puzzle_id: str) -> dict:
    response = s3_client.get_object(Bucket=S3_BUCKET, Key=f"puzzles/{puzzle_id}.json")
    return json.loads(response["Body"].read().decode("utf-8"))


def save_puzzle(s3_client, puzzle_id: str, data: dict):
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=f"puzzles/{puzzle_id}.json",
        Body=json.dumps(data, indent=2).encode("utf-8"),
        ContentType="application/json",
    )


def get_index(s3_client) -> dict:
    response = s3_client.get_object(Bucket=S3_BUCKET, Key="puzzles/index.json")
    return json.loads(response["Body"].read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Generate guided hints for puzzles")
    parser.add_argument("--dry-run", action="store_true", help="Print hints without saving")
    parser.add_argument("--puzzle-id", help="Only process this specific puzzle")
    parser.add_argument("--force", action="store_true", help="Regenerate even if hints exist")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    s3_client = get_s3_client()
    index = get_index(s3_client)
    
    puzzle_ids = []
    if args.puzzle_id:
        puzzle_ids = [args.puzzle_id]
    else:
        puzzle_ids = [p["id"] for p in index["puzzles"]]

    processed = 0
    skipped = 0
    errors = 0

    for pid in sorted(puzzle_ids):
        try:
            puzzle = get_puzzle(s3_client, pid)
        except Exception as e:
            print(f"  ❌ {pid}: Failed to fetch — {e}")
            errors += 1
            continue

        if puzzle.get("guidedHints") and not args.force:
            print(f"  ⏭  {pid}: Already has guided hints ({puzzle['answer']})")
            skipped += 1
            continue

        answer = puzzle["answer"]
        synonyms = []
        for e in puzzle.get("answerEmbeddings", []):
            if isinstance(e, dict) and "text" in e and e["text"] != answer:
                synonyms.append(e["text"])

        print(f"  🧠 {pid}: Generating hints for '{answer}'...")
        
        try:
            hints = generate_hints_for_puzzle(answer, synonyms)
        except Exception as e:
            print(f"  ❌ {pid}: LLM error — {e}")
            errors += 1
            continue

        # Validate structure
        valid_hints = []
        for h in hints:
            if all(k in h for k in ("triggerWords", "similarityRange", "hint", "priority")):
                valid_hints.append(h)
            else:
                print(f"  ⚠️  {pid}: Skipping malformed hint: {h}")

        if not valid_hints:
            print(f"  ❌ {pid}: No valid hints generated")
            errors += 1
            continue

        print(f"  ✅ {pid}: {len(valid_hints)} hints generated")
        for h in valid_hints:
            print(f"     P{h['priority']}: [{h['similarityRange'][0]:.0%}-{h['similarityRange'][1]:.0%}] "
                  f"triggers={h['triggerWords'][:3]}... → {h['hint'][:60]}...")

        if not args.dry_run:
            puzzle["guidedHints"] = valid_hints
            save_puzzle(s3_client, pid, puzzle)
            print(f"  💾 {pid}: Saved to S3")

        processed += 1
        
        # Rate limit: ~3 requests/sec to be safe
        time.sleep(0.5)

    print(f"\nDone! Processed: {processed}, Skipped: {skipped}, Errors: {errors}")


if __name__ == "__main__":
    main()
