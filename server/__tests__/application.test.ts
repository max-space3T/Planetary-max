import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { applyLegacyFixtureMigration, applyLegacyFixtureMigrations } from './migration-fixture';
import { sign } from 'hono/jwt';
import app from '../planetary-max';
import { privateKeyToAccount } from 'viem/accounts';
import { checkoutMessage } from '../../src/shared/checkoutMessage';

let sqlite: InstanceType<typeof DatabaseSync>;
const secret = 'unit-test-signing-key-with-more-than-32-bytes';
function prepare(sql: string) {
  let args: any[] = [];
  const statement = {
    bind(...values: any[]) { args = values; return statement; },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: sqlite.prepare(sql).run(...args) }; },
  };
  return statement;
}
const env = () => ({ ADMIN_LOGIN_LIMITER: { limit: async () => ({success:true}) }, JWT_SECRET: secret, ADMIN_PASSWORD_HASH: '0'.repeat(64), DB: {
  prepare,
  async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
} });
async function request(path: string, method = 'GET', body?: unknown, role?: string, origin = 'https://max.test') {
  const headers: Record<string,string> = { Origin: origin, 'Content-Type': 'application/json' };
  if (role) headers.Authorization = `Bearer ${await sign({ role, exp: Math.floor(Date.now()/1000)+60 }, secret, 'HS256')}`;
  return app.request(`https://max.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env() as never);
}
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys = ON');
  applyLegacyFixtureMigrations(sqlite);
});
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); });

describe('release application boundaries', () => {
  it('logs in with the provisioned password and protects the administrator session', async () => {
    const password = 'synthetic-preview-password-123456789';
    const configured = { ...env(), ADMIN_PASSWORD_HASH: createHash('sha256').update(password).digest('hex') };
    const login = (value: string) => app.request('https://max.test/api/admin/login', {
      method: 'POST', headers: { Origin: 'https://max.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ password: value }),
    }, configured as never);
    expect((await login('wrong-password')).status).toBe(401);
    const response = await login(password);
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(await response.json()).toEqual({ success: true });
    const session = await app.request('https://max.test/api/admin/session', { headers: { Cookie: cookie!.split(';')[0] } }, configured as never);
    expect(session.status).toBe(200);
    const logout = await app.request('https://max.test/api/admin/logout', { method: 'POST', headers: { Origin: 'https://max.test', Cookie: cookie!.split(';')[0] } }, configured as never);
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
  });
  it('fails closed when login is rate limited', async () => {
    const res=await app.request('https://max.test/api/admin/login',{method:'POST',headers:{Origin:'https://max.test','Content-Type':'application/json'},body:JSON.stringify({password:'test'})},{...env(),ADMIN_LOGIN_LIMITER:{limit:async()=>({success:false})}} as never);
    expect(res.status).toBe(429);expect(res.headers.get('Retry-After')).toBe('60');
  });
  it('does not expose historical finance simulations from the production entry point', async () => {
    expect((await request('/v1/beemax/voucher/mint','POST',{})).status).toBe(404);
  });
  it('preserves seeded rows while excluding them from the public catalog', async () => {
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM artworks').get()?.total).toBe(4);
    expect(await (await request('/api/artworks')).json()).toEqual({artworks:[]});
    expect((await request('/api/status')).status).toBe(200);
  });
  it('preserves edited seed works and existing reservations during catalog migration', () => {
    const db=new DatabaseSync(':memory:');
    try {
      applyLegacyFixtureMigrations(db, '0027');
      db.exec("UPDATE artworks SET price_cents=12345 WHERE id='art_001'; INSERT INTO marketplace_orders (id,artwork_id,buyer_id,amount_cents) VALUES ('existing-order','art_002','artist_2',2400); INSERT INTO transactions (artwork_id,buyer_email,tx_reference,created_at) VALUES ('art_003','buyer@example.test','existing-tx',1)");
      applyLegacyFixtureMigration(db, '0027_hide_current_demo_gallery_seed.sql');
      expect(db.prepare("SELECT is_demo FROM artworks WHERE id='art_001'").get()?.is_demo).toBe(0);
      expect(db.prepare("SELECT is_demo FROM artworks WHERE id='art_002'").get()?.is_demo).toBe(0);
      expect(db.prepare("SELECT is_demo FROM artworks WHERE id='art_003'").get()?.is_demo).toBe(0);
      expect(db.prepare("SELECT is_demo FROM artworks WHERE id='art_004'").get()?.is_demo).toBe(1);
      const eventCount = db.prepare('SELECT COUNT(*) AS total FROM beemax_ledger_events').get()?.total;
      applyLegacyFixtureMigration(db, '0027_hide_current_demo_gallery_seed.sql');
      expect(db.prepare('SELECT COUNT(*) AS total FROM beemax_ledger_events').get()?.total).toBe(eventCount);
    } finally { db.close(); }
  });
  it('requires admin authorization for publishing and registry access', async () => {
    for (const path of ['/api/artworks','/v1/dat/sports','/v1/dat/chess','/api/admin/nodes']) expect((await request(path,'POST',{})).status).toBe(401);
    expect((await request('/api/admin/nodes')).status).toBe(401);
    expect((await request('/api/admin/nodes','GET',undefined,'user')).status).toBe(403);
  });
  it('rejects cross-origin authenticated writes', async () => {
    expect((await request('/api/admin/artists','POST',{username:'owner'},'admin','https://attacker.test')).status).toBe(403);
    expect((await request('/api/checkout/verify-usdc','POST',{},undefined,'https://attacker.test')).status).toBe(403);
  });
  it('creates real inventory and exposes no collector fulfillment secrets', async () => {
    const artist = await request('/api/admin/artists','POST',{username:'Test artist',bio:'Test biography'},'admin'); expect(artist.status).toBe(201);
    const result = await request('/api/artworks','POST',{creator:'Test artist',title:'Test artwork',medium:'Digital',price_cents:12500,image_url:'https://max.test/work.png',provenance_hash:'a'.repeat(64),fulfillment_uri:'https://max.test/private.png'},'admin');
    expect(result.status).toBe(201); expect((await result.json()).artwork.id).toBeTruthy();
    const catalog = await (await request('/api/artworks')).json(); expect(catalog.artworks).toHaveLength(1); expect(catalog.artworks[0].title).toBe('Test artwork'); expect(catalog.artworks[0].fulfillment_uri).toBeUndefined();
  });
  it('stores research records for the public sports page', async () => {
    expect((await request('/v1/dat/sports','POST',{eventId:'research-001',league:'NBA',matchup:'Test A vs Test B',oracleConsensus:{predictedWinner:'Test A',confidenceScore:60,dataSourcesCount:2}},'admin')).status).toBe(201);
    expect((await (await request('/v1/dat/sports/list')).json()).telemetry[0].oracle_consensus.confidenceScore).toBe(60);
  });
  it('enrolls and revokes trusted nodes without exposing signing keys', async () => {
    const key = await crypto.subtle.generateKey('Ed25519',true,['sign','verify']) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
    const encoded = Buffer.from(raw).toString('base64url');
    expect((await request('/api/admin/nodes','POST',{node_id:'test-node',public_key_b64:encoded},'admin')).status).toBe(201);
    const listed = await (await request('/api/admin/nodes','GET',undefined,'admin')).json(); expect(listed.nodes[0].status).toBe('ACTIVE'); expect(listed.nodes[0].public_key_b64).toBeUndefined();
    expect((await request('/api/admin/nodes/test-node/revoke','POST',{},'admin')).status).toBe(200);
    expect(sqlite.prepare("SELECT status FROM trusted_nodes WHERE node_id='test-node'").get()?.status).toBe('REVOKED');
    expect(sqlite.prepare("SELECT action FROM beemax_ledger_events WHERE entity_type='node' AND entity_id='test-node' ORDER BY action").all()).toEqual([
      { action: 'ENROLLED' },
      { action: 'REVOKED' },
    ]);
  });
  it('accepts signed node heartbeats and rejects replays', async () => {
    const key = await crypto.subtle.generateKey('Ed25519',true,['sign','verify']) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
    await request('/api/admin/nodes','POST',{node_id:'signed-node',public_key_b64:Buffer.from(raw).toString('base64url')},'admin');
    const body=JSON.stringify({mesh_region:'local-test'}), timestamp=String(Date.now()), nonce='unique-test-nonce-0001';
    const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))).toString('hex');
    const message=`${timestamp}\n${nonce}\nPOST\n/api/beemax/heartbeat\n${hash}`;
    const signature=Buffer.from(await crypto.subtle.sign('Ed25519',key.privateKey,new TextEncoder().encode(message))).toString('base64url');
    const send=()=>app.request('https://max.test/api/beemax/heartbeat',{method:'POST',headers:{'Content-Type':'application/json','X-Max-Node-Id':'signed-node','X-Max-Node-Signature':signature,'X-Max-Timestamp':timestamp,'X-Max-Nonce':nonce},body},env() as never);
    expect((await send()).status).toBe(200);expect((await send()).status).toBe(409);
    expect(sqlite.prepare("SELECT mesh_region FROM node_telemetry WHERE node_id='signed-node'").get()?.mesh_region).toBe('local-test');
  });
  it('rejects oversized requests before parsing their bodies', async () => {
    const response=await app.request('https://max.test/api/admin/login',{method:'POST',body:'x'.repeat(60001)},env() as never);
    expect(response.status).toBe(413);
  });
  it('rejects malformed node keys and returns JSON 404 for unknown APIs', async () => {
    expect((await request('/api/admin/nodes','POST',{node_id:'test-node',public_key_b64:'bad'},'admin')).status).toBe(400);
    const missing = await request('/api/missing'); expect(missing.status).toBe(404); expect(await missing.json()).toEqual({error:'Not found'});
  });
  it('rejects collector access without proof of paying-wallet ownership', async () => {
    expect((await request('/api/checkout/verify-usdc','POST',{artworkId:'art_001',txHash:'0x'+'1'.repeat(64)})).status).toBe(400);
    const account=privateKeyToAccount(('0x'+'4'.repeat(64)) as `0x${string}`);
    const signature=await account.signMessage({message:'unrelated message'});
    expect((await request('/api/checkout/verify-usdc','POST',{artworkId:'art_001',txHash:'0x'+'1'.repeat(64),buyerAddress:account.address,signature})).status).toBe(403);
  });
  it('rolls back the second sale when the same on-chain receipt is reused', async () => {
    sqlite.exec("UPDATE artworks SET is_demo=0, fulfillment_uri='https://max.test/collector' WHERE id IN ('art_001','art_002')");
    const account=privateKeyToAccount(('0x'+'4'.repeat(64)) as `0x${string}`);
    const treasury='0x'+'1'.repeat(40), contract='0x'+'2'.repeat(40), txHash='0x'+'3'.repeat(64);
    vi.spyOn(globalThis,'fetch').mockImplementation(async (_url, options) => {
      const {method}=JSON.parse(String(options?.body));
      const result=method==='eth_chainId'?'0x2105':method==='eth_blockNumber'?'0x64':{status:'0x1',blockNumber:'0x62',logs:[{address:contract,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+account.address.slice(2).toLowerCase().padStart(64,'0'),'0x'+treasury.slice(2).padStart(64,'0')],data:'0x'+(2400n*10000n).toString(16)}]};
      return Response.json({result});
    });
    const verify=async(artworkId:string)=>app.request('https://max.test/api/checkout/verify-usdc',{method:'POST',headers:{Origin:'https://max.test','Content-Type':'application/json'},body:JSON.stringify({artworkId,txHash,buyerAddress:account.address,signature:await account.signMessage({message:checkoutMessage('https://max.test',artworkId,txHash,account.address)})})},{...env(),RPC_URL:'https://rpc.test',TREASURY_WALLET:treasury,USDC_CONTRACT:contract} as never);
    const purchase=await verify('art_001');expect(purchase.status).toBe(200);const first=await purchase.json();
    const retry=await verify('art_001');expect(retry.status).toBe(200);expect((await retry.json()).accessToken).toBe(first.accessToken);
    expect((await verify('art_002')).status).toBe(500);
    expect(sqlite.prepare("SELECT status FROM artworks WHERE id='art_002'").get()?.status).toBe('available');
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM transactions').get()?.total).toBe(1);
  });
});
