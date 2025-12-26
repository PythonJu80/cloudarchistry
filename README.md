# Cloudarchistry

**Interactive AWS Architecture Learning Platform**

Master cloud architecture through hands-on practice, interactive challenges, and gamified learning experiences.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

---

## What is Cloudarchistry?

Cloudarchistry is a comprehensive learning platform designed to help cloud engineers, architects, and students master AWS services and architecture patterns through:

- **Interactive Diagram Builder** - Draw AWS architecture diagrams with a professional canvas, 200+ AWS service icons, and real-time collaboration features
- **Architecture Challenges** - Solve real-world cloud architecture problems with AI-powered feedback and scoring
- **Educational Games** - Learn AWS services through engaging game modes like Speed Deploy, Ticking Bomb, and Service Sniper
- **Study Tools** - Flashcards, practice exams, and an AI-powered study assistant
- **Team Learning** - Cohort management for bootcamps, classrooms, and study groups

---

## Key Features

### Architecture Diagram Canvas

- **200+ AWS Service Icons** - All major AWS services with official iconography
- **Drag & Drop Interface** - Intuitive React Flow-based canvas
- **Grouping & Containers** - VPCs, subnets, availability zones, and custom groups
- **Text Annotations** - Add labels, notes, and documentation
- **Export & Share** - Save diagrams and share with your team

### Challenge System

- **Scenario-Based Challenges** - Real-world architecture problems
- **AI-Powered Auditing** - Get instant feedback on your designs
- **Scoring & Leaderboards** - Compete with other learners
- **Progressive Difficulty** - From beginner to expert level

### Game Modes

| Game | Description |
|------|-------------|
| **Speed Deploy** | Race against time to answer AWS questions |
| **Ticking Bomb** | Hot-potato style multiplayer quiz game |
| **Service Sniper** | Quick-fire service identification |
| **Hot Streak** | Build consecutive correct answer streaks |
| **Bug Bounty** | Find and fix architecture anti-patterns |
| **Architect Arena** | Head-to-head architecture battles |
| **Cloud Tycoon** | Build and manage your cloud empire |
| **Quiz Battle** | Be fast on the buzzer and asnwer correctly to win games over your apponent |

### Learning Tools

- **AI Study Chat** - Ask questions about AWS services and best practices
- **Flashcard Decks** - Spaced repetition for certification prep
- **Practice Exams** - Simulate AWS certification exams
- **Study Notes** - Personal note-taking with markdown support
- **Learning Sources** - Curated resources and documentation

### Team & Cohort Features

- **Team Management** - Create and manage learning cohorts
- **Progress Tracking** - Monitor team member advancement
- **Invite System** - Easy onboarding with invite codes
- **Leaderboards** - Team and global rankings

---

## Architecture

```
cloudmigrate-saas/
├── cloud-academy/          # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   │   ├── diagram/   # Canvas & diagram components
│   │   │   ├── world/     # Challenge workspace
│   │   │   └── ui/        # Shared UI components
│   │   ├── lib/           # Utilities & helpers
│   │   └── store/         # Zustand state management
│   └── prisma/            # Database schema
│
├── learning_agent/         # Python FastAPI backend
│   ├── crawl4ai_mcp.py    # Main API server
│   └── generators/        # AI content generators
│
└── docker-compose.yml      # Container orchestration
```

### Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- React Flow (diagram canvas)
- Zustand (state management)
- Supabase (auth & database)

**Backend:**
- Python FastAPI
- OpenAI / Anthropic APIs
- Crawl4AI (web research)

**Infrastructure:**
- Docker Compose
- PostgreSQL
- Supabase

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.12+ (for learning agent)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/PythonJu80/Cloudarchistry.git
cd Cloudarchistry

# Copy environment file
cp .env.example .env

# Start all services
docker compose --profile prod up -d

# Access the application
open http://localhost:3000
```

### Local Development

```bash
# Frontend
cd cloud-academy
pnpm install
pnpm dev

# Backend (in separate terminal)
cd learning_agent
pip install -e .
python crawl4ai_mcp.py
```

---

## Configuration

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers (optional - users can provide their own)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Learning Agent
LEARNING_AGENT_URL=http://localhost:8000
```

---

## Documentation

- [Adding New Games](./cloud-academy/GAMES.md) - Guide for creating new game modes
- [Challenge System](./cloud-academy/docs/challenges.md) - How challenges work
- [API Reference](./learning_agent/README.md) - Backend API documentation

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Acknowledgments

- AWS for the official service icons
- The React Flow team for the excellent diagram library
- Supabase for the backend infrastructure
- OpenAI and Anthropic for AI capabilities

---

**Built for cloud learners everywhere**
