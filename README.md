# CollabBoard

Real-time collaborative whiteboard with AI agent, built with Next.js 15, Konva.js, Yjs, Socket.io, and Supabase.

**Live Demo:** https://collabboard-gauntlet.vercel.app

---

## Features

- ✅ **Authentication** - Email/password signup and login (Supabase Auth)
- ✅ **Board Management** - Create, list, and navigate boards
- ✅ **Real-time Sync** - Multiplayer collaboration via Yjs CRDT
- 🚧 **Canvas** - Infinite pan/zoom canvas (TICKET-02)
- 🚧 **Sticky Notes** - Create, edit, move, delete notes (TICKET-04)
- 🚧 **Multiplayer Cursors** - See other users' cursors in real-time (TICKET-05)
- 🚧 **AI Agent** - Natural language board manipulation (TICKET-11+)

---

## Quick Start

### Prerequisites

- Node.js 24+ (via nvm recommended)
- npm 11+
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/alediez2048/Gauntlet-Assignment-1.git
cd Gauntlet-Assignment-1

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Available Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm start                # Start production server

# Testing
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Interactive E2E test mode
npm run test:e2e:headed  # Watch browser during E2E tests
npm test                 # Run unit/integration tests (Vitest)

# Code Quality
npm run lint             # Run ESLint
npm run lint -- --fix    # Auto-fix linting issues
```

---

## Project Structure

```
├── app/                 # Next.js 15 App Router
│   ├── api/            # API routes (future)
│   ├── board/[id]/     # Board page (canvas)
│   ├── login/          # Authentication page
│   └── page.tsx        # Home (board list)
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   └── board/          # Board-specific components
├── lib/                 # Shared logic
│   ├── supabase/       # Supabase client utilities
│   └── yjs/            # Yjs/CRDT setup (future)
├── stores/              # Zustand state management
├── tests/
│   └── e2e/            # Playwright E2E tests
├── types/               # TypeScript type definitions
└── public/              # Static assets
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Canvas** | Konva.js + react-konva |
| **Styling** | Tailwind CSS v4 |
| **Real-time** | Yjs (CRDT) + y-websocket, Socket.io |
| **Auth** | Supabase Auth (JWT sessions) |
| **Database** | Supabase PostgreSQL |
| **State** | Zustand (UI only), Yjs (board objects) |
| **Testing** | Playwright (E2E), Vitest (unit/integration) |
| **Deployment** | Vercel (frontend), Railway (WebSocket server - future) |
| **AI** | OpenAI GPT-4o-mini (future) |

---

## Documentation

All project docs live in **`documentation/`** by category:

| Category | Contents |
|----------|----------|
| **[documentation/architecture/](documentation/architecture/)** | [system-design.md](documentation/architecture/system-design.md) — data flow, state ownership, event schema |
| **[documentation/requirements/](documentation/requirements/)** | [PRD.md](documentation/requirements/PRD.md) — product requirements and ticket breakdown |
| **[documentation/testing/](documentation/testing/)** | [TESTS.md](documentation/testing/TESTS.md) — testing guide and strategy |
| **[documentation/agents/](documentation/agents/)** | [agents.md](documentation/agents/agents.md) — coding agent guidelines · [CLAUDE.md](documentation/agents/CLAUDE.md) — quick reference for AI agents |
| **[documentation/reference/](documentation/reference/)** | [presearch.md](documentation/reference/presearch.md) — file structure and architecture reference |
| **[documentation/tickets/](documentation/tickets/)** | [TICKETS.md](documentation/tickets/TICKETS.md) — progress tracker · [DEV-LOG.md](documentation/tickets/DEV-LOG.md) — development log · ticket primers (TICKET-02 through TICKET-04) |

---

## Testing

This project follows a comprehensive testing strategy:

- **E2E Tests** (Playwright) - User flows, multiplayer sync
- **Integration Tests** (Vitest) - Server logic, Yjs sync
- **Unit Tests** (Vitest) - Component logic, utilities
- **Manual Testing** - UX validation, performance

See **[documentation/testing/TESTS.md](documentation/testing/TESTS.md)** for detailed testing documentation including:
- Per-ticket testing checklists
- Multi-browser testing setup
- Debugging guides
- CI/CD integration plans

---

## Development Workflow

1. **Read ticket** in [documentation/requirements/PRD.md](documentation/requirements/PRD.md)
2. **Create feature branch** (e.g., `feat/canvas`)
3. **Implement feature** following TDD principles
4. **Run tests** (lint, build, E2E, manual)
5. **Update documentation** ([documentation/tickets/DEV-LOG.md](documentation/tickets/DEV-LOG.md), [documentation/tickets/TICKETS.md](documentation/tickets/TICKETS.md))
6. **Commit and push** with conventional commits
7. **Deploy** via Vercel (auto-deploy from `main`)

---

## Contributing

This is a submission for the Gauntlet AI assignment. Not accepting external contributions at this time.

---

## License

Private project for Gauntlet AI interview process.

---

## Links

- **Live App:** https://collabboard-gauntlet.vercel.app
- **GitHub:** https://github.com/alediez2048/Gauntlet-Assignment-1
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ifagtpezakzdztufnyze

---

**Built by:** JAD  
**Sprint:** Feb 16-23, 2026  
**Assignment:** Gauntlet AI - CollabBoard
