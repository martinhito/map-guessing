# Deployment Guide

## Option 1: Vercel (Frontend) + Railway (Backend)

This is the recommended approach for an MVP - easy to set up, free/cheap tiers available.

### Prerequisites
- GitHub account (for deployment integration)
- AWS S3 bucket already set up with your puzzles
- OpenAI API key

### Step 1: Deploy Backend to Railway

1. **Create Railway account**: Go to [railway.app](https://railway.app) and sign up

2. **Create new project**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Connect your GitHub and select your repository
   - Choose the `backend` folder as the root directory

3. **Set environment variables** in Railway dashboard:
   ```
   OPENAI_API_KEY=sk-your-key
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=your-bucket-name
   DATABASE_URL=sqlite:///./map_guessing.db
   ```

4. **Generate domain**:
   - Go to Settings → Networking → Generate Domain
   - You'll get something like `your-app.up.railway.app`

5. **Note your backend URL** for the frontend configuration

### Step 2: Deploy Frontend to Vercel

1. **Create Vercel account**: Go to [vercel.com](https://vercel.com) and sign up

2. **Import project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Set the **Root Directory** to `frontend`

3. **Configure environment variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-app.up.railway.app
   ```

4. **Deploy**: Vercel will automatically build and deploy

5. **Set up custom domain** (optional):
   - Go to Settings → Domains
   - Add your custom domain

### Step 3: Update CORS

Update the backend to allow your Vercel domain. Edit `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Add your Vercel URL
        "https://yourdomain.com",        # Add custom domain if any
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Redeploy the backend after this change.

---

## Option 2: Render (Both services)

Render offers free tiers for both static sites and web services.

### Backend on Render

1. Go to [render.com](https://render.com) and create account

2. New → Web Service → Connect your repo

3. Configure:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Add environment variables (same as Railway)

### Frontend on Render

1. New → Static Site → Connect your repo

2. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `out` (for static export) or use Next.js server

---

## Option 3: Fly.io (Both services)

Good for more control, pay-as-you-go pricing.

### Create fly.toml for backend:

```toml
app = "map-guessing-api"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

Deploy with:
```bash
cd backend
fly launch
fly secrets set OPENAI_API_KEY=sk-xxx AWS_ACCESS_KEY_ID=xxx ...
fly deploy
```

---

## Option 4: DigitalOcean App Platform

1. Create account at [digitalocean.com](https://digitalocean.com)

2. Create App → GitHub → Select repo

3. Configure two components:
   - **Web Service** (backend): Python, source dir `backend`
   - **Static Site** (frontend): Node.js, source dir `frontend`

4. Set environment variables for backend

5. Deploy

---

## Option 5: Self-hosted VPS with Docker

For more control, use a VPS (DigitalOcean Droplet, Linode, etc.)

### docker-compose.yml (for production):

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certbot/conf:/etc/letsencrypt
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

---

## S3 Bucket Configuration

Make sure your S3 bucket has proper CORS settings to allow image loading:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET"],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://your-app.vercel.app",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": []
    }
]
```

Also ensure the bucket policy allows public read for images:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadForImages",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/puzzles/images/*"
        }
    ]
}
```

---

## Cost Estimates (Monthly)

| Option | Frontend | Backend | Total |
|--------|----------|---------|-------|
| Vercel + Railway | Free | ~$5 | ~$5 |
| Render (free tier) | Free | Free (sleeps after 15min) | Free |
| Render (paid) | Free | $7 | $7 |
| Fly.io | ~$2 | ~$5 | ~$7 |
| DigitalOcean | $5 | $5 | $10 |
| VPS + Docker | - | $5-10 | $5-10 |

Plus:
- OpenAI API: ~$0.02 per 1M tokens (very cheap for embeddings)
- S3: ~$0.023/GB storage + $0.09/GB transfer (negligible for images)

---

## Quick Start: Vercel + Railway

```bash
# 1. Push code to GitHub
cd claude_map_guessing
git init
git add .
git commit -m "Initial commit"
gh repo create map-guessing --public --push

# 2. Deploy backend to Railway
# - Go to railway.app
# - New Project → Deploy from GitHub
# - Select repo, set root to "backend"
# - Add environment variables
# - Generate domain

# 3. Deploy frontend to Vercel
# - Go to vercel.com
# - Import GitHub repo
# - Set root to "frontend"
# - Add NEXT_PUBLIC_API_URL env var
# - Deploy

# 4. Update CORS in backend and redeploy
```
