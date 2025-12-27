from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""
    s3_puzzle_prefix: str = "puzzles/"

    # Game settings
    default_similarity_threshold: float = 0.95
    max_guesses: int = 6

    # Database
    database_url: str = "sqlite:///./map_guessing.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
