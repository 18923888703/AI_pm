import { getStore } from '@netlify/blobs';
import { handleSync } from '../lib/sync-protocol.mjs';

export default async function syncMemory(request) {
  try {
    return await handleSync(request, getStore('aipm-learning-sync'), {
      roomId: process.env.AIPM_SYNC_ROOM_ID,
      authHash: process.env.AIPM_SYNC_AUTH_HASH
    });
  } catch (error) {
    console.error('Encrypted memory sync failed:', error && error.message || error);
    return new Response(JSON.stringify({ error: 'sync-unavailable' }), { status: 503, headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
    } });
  }
}
