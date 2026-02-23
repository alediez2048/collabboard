import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Y from 'yjs';
import type { BoardObject } from '@/lib/yjs/board-doc';
import { NextRequest, NextResponse } from 'next/server';

function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createServiceClient(url, key);
}

// POST /api/templates — save a board as a custom template
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      boardId?: string;
      name?: string;
      description?: string;
    } | null;

    if (!body?.boardId || typeof body.boardId !== 'string') {
      return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
    }
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const boardId = body.boardId.trim();
    const name = body.name.trim();
    const description = (body.description ?? '').trim();

    const serviceSupabase = getServiceSupabase();

    const { data: snapshot, error: snapError } = await serviceSupabase
      .from('board_snapshots')
      .select('yjs_state')
      .eq('board_id', boardId)
      .single();

    if (snapError || !snapshot) {
      return NextResponse.json({ error: 'Board snapshot not found' }, { status: 404 });
    }

    const raw = snapshot.yjs_state;
    let stateBuffer: Buffer;
    if (typeof raw === 'string') {
      stateBuffer = raw.startsWith('\\x')
        ? Buffer.from(raw.substring(2), 'hex')
        : Buffer.from(raw, 'base64');
    } else {
      stateBuffer = Buffer.from(raw as Buffer);
    }

    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, new Uint8Array(stateBuffer));
    } catch {
      doc.destroy();
      return NextResponse.json({ error: 'Failed to parse board snapshot' }, { status: 500 });
    }

    const objects = doc.getMap<BoardObject>('objects');
    const objectCount = objects.size;
    doc.destroy();

    const hexState = '\\x' + stateBuffer.toString('hex');

    const { data: template, error: insertError } = await serviceSupabase
      .from('custom_templates')
      .insert({
        name,
        description,
        created_by: user.id,
        yjs_state: hexState,
        object_count: objectCount,
      })
      .select('id, name, description, object_count, created_at')
      .single();

    if (insertError || !template) {
      console.error('[Custom Templates] Insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[Custom Templates] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/templates — list custom templates for the current user
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: templates, error: listError } = await supabase
      .from('custom_templates')
      .select('id, name, description, object_count, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (listError) {
      console.error('[Custom Templates] List failed:', listError);
      return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
    }

    return NextResponse.json({ templates: templates ?? [] });
  } catch (error) {
    console.error('[Custom Templates] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
