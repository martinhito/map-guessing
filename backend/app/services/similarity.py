import math
from typing import List


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not a or not b:
        return 0.0

    size = min(len(a), len(b))
    dot_product = sum(a[i] * b[i] for i in range(size))
    norm_a = math.sqrt(sum(x * x for x in a[:size]))
    norm_b = math.sqrt(sum(x * x for x in b[:size]))

    denominator = norm_a * norm_b
    if denominator < 1e-9:
        return 0.0

    return dot_product / denominator
