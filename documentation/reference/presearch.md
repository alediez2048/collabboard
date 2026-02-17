# CollabBoard — Pre-Search / Architecture Reference

Architectural decisions and tech choices are summarized in **documentation/requirements/PRD.md** (Architecture Summary table) and **documentation/architecture/system-design.md** (data flow, state ownership, event schemas). This file adds the recommended file structure so scaffolding and agents stay consistent.

---

## 13. Recommended file structure

After TICKET-01 (scaffold) and before TICKET-03 (server), the repo should look like this. Adjust only when a ticket explicitly requires it.

```
/
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Landing: board list + "Create Board"
│   ├── login/
│   │   └── page.tsx              # Auth: sign up / sign in
│   ├── board/
│   │   └── [id]/
│   │       └── page.tsx          # Protected board canvas (Konva later)
│   └── api/                      # API routes (e.g. AI agent later)
├── components/                   # React components
│   ├── ui/                       # Reusable UI (buttons, inputs)
│   └── board/                    # Board-specific (canvas, toolbar, etc.)
├── lib/                          # Shared client/server logic
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client (if needed)
│   ├── yjs/                      # TICKET-03+
│   │   ├── provider.ts           # y-websocket provider
│   │   └── board-doc.ts          # Y.Doc / Y.Map for board objects
│   └── sync/                     # TICKET-03+
│       └── cursor-socket.ts     # Socket.io cursor broadcast
├── stores/                       # Zustand stores (UI only: tool, zoom, pan)
├── server/                       # TICKET-03: separate Node process
│   ├── package.json
│   ├── index.ts                  # y-websocket + Socket.io, JWT auth
│   └── .env                     # Server-only env (not committed)
├── public/
├── .env.example                  # Required env vars (no secrets)
├── .env.local                    # Local overrides (gitignored)
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

- **Board object state:** Only in Yjs (lib/yjs, synced via server). Never in Zustand or direct Supabase writes.
- **Zustand:** UI state only (selected tool, zoom, pan, sidebar open/closed).
- **Auth:** Supabase Auth; protect `/board/[id]` and verify JWT on WebSocket connect (server).
