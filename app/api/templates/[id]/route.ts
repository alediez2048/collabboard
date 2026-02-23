import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import * as Y from 'yjs';
import type { BoardObject } from '@/lib/yjs/board-doc';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getServiceSupabase(): ReturnType<typeof createServiceClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createServiceClient(url, key);
}

// DELETE /api/templates/[id] — delete a custom template
export async function DELETE(
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

    const { id: templateId } = await params;
    if (!templateId || templateId.trim().length === 0) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('custom_templates')
      .delete()
      .eq('id', templateId.trim())
      .eq('created_by', user.id);

    if (deleteError) {
      console.error('[Custom Templates] Delete failed:', deleteError);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Custom Templates] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/templates/[id] — create a board from a custom template
export async function POST(
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

    const { id: templateId } = await params;
    if (!templateId || templateId.trim().length === 0) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const serviceSupabase = getServiceSupabase();

    const { data: template, error: fetchError } = await serviceSupabase
      .from('custom_templates')
      .select('name, yjs_state, created_by')
      .eq('id', templateId.trim())
      .single();

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.created_by !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: board, error: createError } = await supabase
      .from('boards')
      .insert({
        name: template.name,
        created_by: user.id,
      })
      .select('id, name, created_by, created_at')
      .single();

    if (createError || !board) {
      console.error('[Custom Templates] Board creation failed:', createError);
      return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
    }

    // Re-key all objects so the new board gets fresh IDs
    const raw = template.yjs_state;
    let stateBuffer: Buffer;
    if (typeof raw === 'string') {
      stateBuffer = raw.startsWith('\\x')
        ? Buffer.from(raw.substring(2), 'hex')
        : Buffer.from(raw, 'base64');
    } else {
      stateBuffer = Buffer.from(raw as Buffer);
    }

    const sourceDoc = new Y.Doc();
    try {
      Y.applyUpdate(sourceDoc, new Uint8Array(stateBuffer));
    } catch {
      sourceDoc.destroy();
      await supabase.from('boards').delete().eq('id', board.id);
      return NextResponse.json({ error: 'Corrupted template snapshot' }, { status: 500 });
    }

    const sourceObjects = sourceDoc.getMap<BoardObject>('objects');
    const now = new Date().toISOString();

    const newDoc = new Y.Doc();
    const newObjects = newDoc.getMap<BoardObject>('objects');
    const idMap = new Map<string, string>();

    newDoc.transact(() => {
      sourceObjects.forEach((obj) => {
        const newId = crypto.randomUUID();
        idMap.set(obj.id, newId);
        newObjects.set(newId, {
          ...obj,
          id: newId,
          createdBy: user.id,
          updatedAt: now,
        });
      });

      // Re-link connectors to new IDs
      newObjects.forEach((obj) => {
        if (obj.type !== 'connector') return;
        const fromId = obj.properties.fromId;
        const toId = obj.properties.toId;
        if (typeof fromId === 'string' || typeof toId === 'string') {
          newObjects.set(obj.id, {
            ...obj,
            properties: {
              ...obj.properties,
              ...(typeof fromId === 'string' && idMap.has(fromId) ? { fromId: idMap.get(fromId) } : {}),
              ...(typeof toId === 'string' && idMap.has(toId) ? { toId: idMap.get(toId) } : {}),
            },
          });
        }
      });
    });

    sourceDoc.destroy();

    const state = Y.encodeStateAsUpdate(newDoc);
    const hexState = '\\x' + Buffer.from(state).toString('hex');
    newDoc.destroy();

    const { error: snapError } = await serviceSupabase
      .from('board_snapshots')
      .upsert(
        { board_id: board.id, yjs_state: hexState, snapshot_at: now },
        { onConflict: 'board_id' },
      );

    if (snapError) {
      console.error('[Custom Templates] Snapshot save failed:', snapError);
      await supabase.from('boards').delete().eq('id', board.id);
      return NextResponse.json({ error: 'Failed to seed board from template' }, { status: 500 });
    }

    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    console.error('[Custom Templates] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
