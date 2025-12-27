# Map Guessing Game

A Wordle-style web app where users guess what a map represents. Uses OpenAI embeddings to calculate semantic similarity between guesses and the correct answer.

## Features

- Daily map puzzle (same for all users based on UTC date)
- Semantic similarity scoring using OpenAI embeddings
- Configurable similarity threshold per puzzle (default 95%)
- Progressive hints system
- Persistent user attempts via cookies + SQLite

## Tech Stack

- **Backend**: Python (FastAPI)
- **Frontend**: TypeScript (Next.js)
- **Storage**: AWS S3 (images + puzzle metadata)
- **Database**: SQLite (user attempts)

## Project Structure

```
claude_map_guessing/
├── backend/           # FastAPI Python backend
│   ├── app/
│   │   ├── main.py    # App entry point
│   │   ├── config.py  # Settings
│   │   ├── models/    # Pydantic models
│   │   ├── services/  # Business logic
│   │   ├── routes/    # API endpoints
│   │   └── db/        # SQLAlchemy models
│   └── requirements.txt
├── frontend/          # Next.js TypeScript frontend
│   ├── src/
│   │   ├── app/       # Next.js app router
│   │   ├── components/# React components
│   │   ├── hooks/     # Custom hooks
│   │   └── lib/       # API client, types
│   └── package.json
└── scripts/           # Utility scripts
    └── upload_puzzle.py
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- AWS S3 bucket
- OpenAI API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your credentials

# Run the server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
cp .env.local.example .env.local
# Edit if needed (default API URL is http://localhost:8000)

# Run the dev server
npm run dev
```

The frontend will be available at http://localhost:3000

### Uploading Puzzles

Use the upload script to add puzzles to S3:

```bash
cd scripts

# Set environment variables
export OPENAI_API_KEY=sk-...
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export S3_BUCKET_NAME=your-bucket
export AWS_REGION=us-east-1

# Upload a puzzle
python upload_puzzle.py \
  --image ./maps/income-map.png \
  --answer "Median household income by US county" \
  --hints "This map shows economic data" "The data is measured in dollars" \
  --date 2024-12-26
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/puzzle` | GET | Get today's puzzle |
| `/api/puzzle/{id}/guess` | POST | Submit a guess |
| `/api/puzzle/{id}/attempts` | GET | Get user's attempts |
| `/api/puzzle/{id}/hint` | GET | Reveal next hint |
| `/health` | GET | Health check |

## S3 Data Structure

```
s3://your-bucket/
└── puzzles/
    ├── 2024-12-26.json    # Puzzle metadata
    └── images/
        └── 2024-12-26.png  # Map image
```

### Puzzle JSON Schema

```json
{
  "id": "2024-12-26",
  "imageUrl": "https://bucket.s3.region.amazonaws.com/puzzles/images/2024-12-26.png",
  "answer": "Median household income by US county",
  "maxGuesses": 6,
  "similarityThreshold": 0.95,
  "answerEmbedding": [0.0123, -0.0456, ...],
  "hints": ["Hint 1", "Hint 2"]
}
```

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `S3_BUCKET_NAME` | S3 bucket name | Required |
| `AWS_REGION` | AWS region | us-east-1 |
| `DATABASE_URL` | SQLite database path | sqlite:///./map_guessing.db |
| `DEFAULT_SIMILARITY_THRESHOLD` | Default win threshold | 0.95 |
| `MAX_GUESSES` | Default max guesses | 6 |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | http://localhost:8000 |

## How It Works

1. **Daily Puzzle**: The puzzle ID is the UTC date (YYYY-MM-DD). All users see the same puzzle.

2. **Guessing**: When a user submits a guess:
   - The guess is embedded using OpenAI's `text-embedding-3-small` model
   - Cosine similarity is calculated between the guess embedding and the pre-stored answer embedding
   - If similarity >= threshold (default 95%), the user wins

3. **Hints**: Puzzles can have optional hints that users can reveal progressively.

4. **Persistence**: User attempts are stored in SQLite, identified by a cookie-based player ID.
