# Cloud Archistry — Platform Overview

## The Gamified AWS Certification Platform

---

**Cloud Archistry** is a gamified learning platform that transforms AWS certification preparation from passive video-watching into active, hands-on architecture design. We combine real-world business scenarios, AI-powered coaching, and competitive gaming to help professionals master cloud computing while building portfolio-ready work.

---

### World Map

The platform centres on an interactive **3D globe and satellite map** where users discover real businesses worldwide. Click on HSBC London, NHS Leeds, Shopify Ottawa, or Canva Sydney—or search for any company via Google Places integration. The AI researches the selected business and generates custom AWS challenges based on actual industry requirements, compliance needs (PCI-DSS, HIPAA, GDPR), and technical constraints. Challenges scale from beginner to expert difficulty.

### Architecture Canvas

Users don't just answer multiple choice questions—they **design real architectures**. Our React Flow-powered canvas provides drag-drop access to 150+ official AWS service icons. Real-time validation checks placement rules, connection logic, high-availability patterns, and security best practices. When ready, users submit their design for AI audit, receiving detailed scoring with correct elements, missing components, and improvement suggestions.

### AI Coaching

Thirteen certification-specific AI personas provide personalised guidance throughout the learning journey. Each coach has a distinct teaching style: **Sophia** (Solutions Architect Associate) is scenario-driven, **Dev** (Developer Associate) is code-first, **Sam** (Security Specialty) thinks defense-in-depth, and **Archie** (SA Professional) challenges assumptions with deep technical questions. Coaches adapt to user skill level and certification target.

### Game Zone

Ten competitive game modes make learning addictive:

- **Quiz Battle** — 1v1 ELO-ranked buzzer quiz
- **Speed Deploy** — Race to architect the correct solution
- **Hot Streak** — Build combo multipliers with consecutive correct answers
- **Service Sniper** — Shoot real AWS services, avoid fakes
- **Service Slots** — Match three services that work together
- **Cloud Tycoon** — Business simulation earning virtual millions
- **Ticking Bomb** — Party game (2-8 players) hot potato quiz
- **Bug Bounty** — Find flaws in architecture diagrams
- **Architect Arena** — 1v1 design under pressure, AI judges
- **Sniper Quiz** — Quick-fire targeted questions

### Practice Exams

Full-length practice exams cover all 13+ AWS certifications—from Cloud Practitioner to Solutions Architect Professional to Security Specialty. Exams are timed, domain-weighted, and include detailed explanations for every question. Progress tracking shows attempts, best scores, and pass rates.

### Study Tools

The Learning Centre provides comprehensive study support: **Flashcards** with spaced repetition (SM-2 algorithm), **Study Notes** with AI-generated content and user annotations, **Quizzes** for quick knowledge checks, and a **Resource Library** of curated videos, documentation, and bookmarks.

### Portfolio System

Every completed challenge generates a professional portfolio piece—PDF case study with architecture diagram (SVG export), business context, problem statement, solution summary, and key design decisions. Shareable public links let users showcase their work to recruiters and employers.

### Team & Cohort Management

Tutors and training providers can create cohorts, invite learners via email, track team progress through analytics dashboards, and export progress reports. The system supports collaborative learning with team challenges and leaderboards.

### Dashboard & Progress

Users track their journey through a comprehensive dashboard showing XP and leveling, daily streaks, certification readiness scores, weak area identification, gaming stats (ELO rating, rank, win rate), and detailed challenge-by-challenge progress.

---

### Technical Architecture

- **Frontend:** Next.js 14, React Flow, TailwindCSS, Three.js (3D globe)
- **Backend:** FastAPI (Python), Next.js API routes
- **Database:** PostgreSQL with Prisma ORM, Neo4j knowledge graph
- **AI:** OpenAI GPT-4 integration, Crawl4AI for RAG
- **Infrastructure:** Vercel, Railway, AWS

---

Cloud Archistry covers the complete AWS certification journey—from foundational Cloud Practitioner through professional and specialty certifications—with hands-on, gamified learning that builds real skills and career-ready portfolios.
