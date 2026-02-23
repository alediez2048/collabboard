import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import * as Y from 'yjs';
import type { BoardObject } from '@/lib/yjs/board-doc';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SnapshotResponse {
  objects: BoardObject[];
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    if (!boardId || boardId.trim().length === 0) {
      return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
    }

    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId.trim())
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createServiceClient(serviceUrl, serviceKey);

    const { data: snapshot, error: snapError } = await serviceSupabase
      .from('board_snapshots')
      .select('yjs_state')
      .eq('board_id', boardId.trim())
      .single();

    if (snapError || !snapshot) {
      const response: SnapshotResponse = { objects: [] };
      return NextResponse.json(response);
    }

    const doc = new Y.Doc();
    try {
      const raw = snapshot.yjs_state;
      let stateBuffer: Buffer;
      if (typeof raw === 'string') {
        stateBuffer = raw.startsWith('\\x')
          ? Buffer.from(raw.substring(2), 'hex')
          : Buffer.from(raw, 'base64');
      } else {
        stateBuffer = Buffer.from(raw as Buffer);
      }
      Y.applyUpdate(doc, new Uint8Array(stateBuffer));
    } catch {
      doc.destroy();
      const response: SnapshotResponse = { objects: [] };
      return NextResponse.json(response);
    }

    const objects = doc.getMap<BoardObject>('objects');
    const allObjects: BoardObject[] = [];
    objects.forEach((v) => allObjects.push(v));
    doc.destroy();

    const response: SnapshotResponse = { objects: allObjects };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Snapshot API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
