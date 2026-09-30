# ReachInbox Email Scheduler

A production-grade email scheduler service with dashboard for managing scheduled email campaigns.

## Architecture

### Stack
- **Backend**: TypeScript, Express, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer, Elasticsearch
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Infrastructure**: Docker Compose (Postgres, Redis, Elasticsearch)

## Getting Started

### Prerequisites
- Node.js 20+ (22 LTS recommended)
- Docker & Docker Compose
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd reachinbox-scheduler

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start infrastructure services
docker compose up -d
```

### Configuration

**Environment Variables:**

The project uses a single unified `.env` file at the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual credentials
nano .env  # or use your preferred editor
```

**Required Configuration:**
- `JWT_SECRET`: Generate with `openssl rand -hex 32`
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `BULL_BOARD_PASSWORD`: Dashboard admin password

See `.env.example` for all available options.

**Google OAuth Setup:**
Follow the detailed guide in `GOOGLE_OAUTH_SETUP.md` to configure Google authentication.

### Development

```bash
# Terminal 1: Start backend (API + Workers)
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: View logs (optional)
docker compose logs -f
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Bull Board: http://localhost:4000/admin/queues
- Health Check: http://localhost:4000/health

### Testing

### Deployment

## Project Structure

## API Documentation

## Features

## License
