# CollabBoard Real-Time Sync Server

Node.js server providing real-time synchronization for the CollabBoard whiteboard application.

## Architecture

- **y-websocket**: CRDT-based synchronization for board objects
- **Socket.io**: High-frequency cursor position broadcast
- **Supabase Auth**: JWT-based WebSocket authentication

## Services

| Service | Path | Purpose |
|---------|------|---------|
| y-websocket | `ws://localhost:4000/yjs` | Board object sync via Yjs CRDT |
| Socket.io | `http://localhost:4000` | Cursor position broadcast |
| Health Check | `http://localhost:4000/health` | Server status endpoint |

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the `server/` directory:

```bash
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
NODE_ENV=development
```

### 3. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:4000` with hot-reload enabled.

### 4. Build for Production

```bash
npm run build
npm start
```

## Testing

### Manual Testing

1. Start the server: `npm run dev`
2. Open browser console at `http://localhost:3000/board/test-board-id`
3. Look for connection logs:
   - "Yjs Provider: Connection status: connected"
   - "Cursor Socket: Connected"

### Integration Testing

Run Vitest tests (in parent directory):

```bash
cd ..
npm test tests/integration/yjs-sync.test.ts
```

## WebSocket Authentication

Both y-websocket and Socket.io connections require a valid Supabase JWT:

**y-websocket:**
- Token passed as query parameter: `?token=<jwt>`
- Connection rejected if token is missing or invalid

**Socket.io:**
- Token passed in `auth.token` during handshake
- Connection rejected if token is missing or invalid

## Deployment

### Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add environment variables in Railway dashboard
5. Deploy: `railway up`

### Environment Variables (Production)

```
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
NODE_ENV=production
```

## Logs

The server logs all connection events:

```
[Yjs] User user@example.com connected to room: board-123
[Socket.io] User user@example.com connected (abc123)
[Yjs] User user@example.com disconnected from room: board-123
```

## Troubleshooting

**"Connection rejected: No token provided"**
- Ensure client passes JWT in connection params

**"Connection rejected: Invalid token"**
- Check that SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Verify token is a valid Supabase session token

**Port already in use**
- Change PORT in `.env` or kill process on port 4000:
  ```bash
  lsof -ti:4000 | xargs kill
  ```

## Architecture Notes

- Documents stored in-memory (Map<roomName, Y.Doc>)
- TICKET-07 will add persistence to Supabase
- Each board has one Y.Doc (room name = board ID)
- Cursor events are ephemeral (not persisted)
