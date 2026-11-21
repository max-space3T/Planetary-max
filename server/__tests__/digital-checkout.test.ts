import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { applyLegacyFixtureMigrations } from './migration-fixture';
import { createHash } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { sign } from 'hono/jwt';
import app from '../planetary-max';
import { checkoutMessage, digitalCheckoutMessage } from '../../src/shared/checkoutMessage';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
let db: InstanceType<typeof DatabaseSync>;
let aggregateChanges = false;
const secret = 'independent-digital-checkout-test-secret-123456';
const buyer = privateKeyToAccount(('0x' + '4'.repeat(64)) as `0x${string}`);
const treasury = '0x' + '1'.repeat(40), contract = '0x' + '2'.repeat(40), tx = '0x' + '3'.repeat(64);
function prepare(sql: string) {
  let args: any[] = [];
  const stmt = { bind(...values: any[]) { args = values; return stmt; }, async first() { return db.prepare(sql).get(...args) || null; }, async all() { return { results: db.prepare(sql).all(...args) }; }, async run() { const result=db.prepare(sql).run(...args); return { meta: { ...result, changes: Number(result.changes)+(aggregateChanges ? 5 : 0) } }; } }; return stmt;
}
const bindings = () => ({ JWT_SECRET: secret, RPC_URL: 'https://rpc.test', USDC_CONTRACT: contract, TREASURY_WALLET: treasury, DB: { prepare, async batch(statements: ReturnType<typeof prepare>[]) { db.exec('BEGIN'); try { const result = []; for (const s of statements) result.push(await s.run()); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } } } });
function release(id = 'game', editions = 2) {
  db.prepare(`INSERT INTO digital_products(id,kind,title,creator,description,image_url,destination_url,price_cents,currency,platform,version,status,fulfillment_uri,metadata_hash,total_editions,delivery_protection)
    VALUES (?,'game','Synthetic game','Test artist','Test only','https://cover.test/image','https://old-store.test/hidden',1250,'USDC','Web','1','published','https://private.test/game',?,?,'access_controlled')`).run(id, 'a'.repeat(64), editions);
}
function rpc(override: Record<string, unknown> = {}) {
  const receipt = { status: '0x1', blockNumber: '0x62', logs: [{ address: contract, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x' + buyer.address.slice(2).toLowerCase().padStart(64, '0'), '0x' + treasury.slice(2).padStart(64, '0')], data: '0x' + (1250n * 10000n).toString(16) }] };
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const method = JSON.parse(String(init?.body)).method;
    return Response.json({ result: Object.hasOwn(override, method) ? override[method] : method === 'eth_chainId' ? '0x2105' : method === 'eth_blockNumber' ? '0x64' : receipt });
  });
}
async function verify(productId = 'game', txHash = tx, message?: string, origin = 'https://max.test', customBindings: any = bindings()) {
  return app.request('https://max.test/api/catalog/verify-usdc', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, txHash, buyerAddress: buyer.address, signature: await buyer.signMessage({ message: message || digitalCheckoutMessage('https://max.test', productId, txHash, buyer.address) }) }) }, customBindings as never);
}
beforeEach(() => { aggregateChanges=false; db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); applyLegacyFixtureMigrations(db); });
afterEach(() => { vi.restoreAllMocks(); db.close(); });
describe('direct digital settlement', () => {
  it('issues a wallet-bound edition receipt, protects delivery and recovers the same acquisition', async () => {
    release(); rpc();
    const result = await verify(); expect(result.status).toBe(200); const first = await result.json() as any;
    const url = new URL(first.unlockUrl, 'https://max.test'); const id = url.pathname.split('/')[2]; const token = url.searchParams.get('token');
    expect((await verify()).status).toBe(200); expect(await (await verify()).json()).toEqual(first);
    expect(db.prepare('SELECT sold_count FROM digital_products').get().sold_count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM digital_orders').get().n).toBe(1);
    expect((await app.request(`https://max.test/api/catalog/orders/${id}/unlock`, {}, bindings() as never)).status).toBe(401);
    expect((await app.request(`https://max.test/api/catalog/orders/${id}/unlock`, { headers: { Authorization: 'Bearer invalid' } }, bindings() as never)).status).toBe(403);
    db.exec("UPDATE digital_products SET fulfillment_uri='https://private.test/new-version',status='archived'");
    const delivery = await app.request(`https://max.test/api/catalog/orders/${id}/unlock`, { headers: { Authorization: `Bearer ${token}` } }, bindings() as never);
    const asset = await delivery.json() as any;
    expect(delivery.headers.get('Cache-Control')).toBe('no-store'); expect(asset.gateway_url).toBe('https://private.test/game'); expect(asset.edition_number).toBe(1);
    expect(createHash('sha256').update(asset.certificate_payload).digest('hex')).toBe(asset.certificate_hash);
    expect(JSON.parse(asset.certificate_payload).buyer).toBe(buyer.address.toLowerCase());
    expect(db.prepare("SELECT COUNT(*) AS n FROM beemax_ledger_events WHERE entity_type='digital_order' AND action='PAYMENT_CONFIRMED'").get().n).toBe(1);
  });
  it('rejects cross-origin requests and signatures for another site, asset or artwork domain', async () => {
    release(); const fetchMock = rpc();
    expect((await verify('game',tx,undefined,'https://attacker.test')).status).toBe(403);
    for (const message of [digitalCheckoutMessage('https://other.test','game',tx,buyer.address), digitalCheckoutMessage('https://max.test','other',tx,buyer.address), checkoutMessage('https://max.test','game',tx,buyer.address)]) expect((await verify('game',tx,message)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not consume an edition for pending, reverted, wrong-chain or unmatched payments', async () => {
    release();
    const cases = [
      { override: { eth_chainId: '0x1' }, status: 503 },
      { override: { eth_getTransactionReceipt: null }, status: 202 },
      { override: { eth_getTransactionReceipt: { status: '0x0' } }, status: 403 },
      { override: { eth_blockNumber: '0x62' }, status: 202 },
      { override: { eth_getTransactionReceipt: { status: '0x1', blockNumber: '0x62', logs: [] } }, status: 403 },
    ];
    for (const { override, status } of cases) { vi.restoreAllMocks(); rpc(override); expect((await verify()).status).toBe(status); }
    expect(db.prepare('SELECT sold_count FROM digital_products').get().sold_count).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM settlement_claims').get().n).toBe(0);
  });
  it('requires the configured token, recipient, paying wallet in the same transfer log', async () => {
    release();
    const topic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const sender='0x'+buyer.address.slice(2).toLowerCase().padStart(64,'0'),recipient='0x'+treasury.slice(2).padStart(64,'0');
    for (const log of [
      {address:'0x'+'9'.repeat(40),topics:[topic,sender,recipient],data:'0xffffff'},
      {address:contract,topics:[topic,sender,'0x'+'9'.repeat(64)],data:'0xffffff'},
      {address:contract,topics:[topic,'0x'+'9'.repeat(64),recipient],data:'0xffffff'},
      
    ]) {
      vi.restoreAllMocks();rpc({eth_getTransactionReceipt:{status:'0x1',blockNumber:'0x62',logs:[log]}});
      expect((await verify()).status).toBe(403);
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM digital_orders').get().n).toBe(0);
  });
  it('enforces edition supply under competing verified purchases and permits sold-out receipt recovery', async () => {
    release('game',1); rpc();
    const results = await Promise.all([verify(),verify('game','0x'+'5'.repeat(64))]);
    expect(results.map(r=>r.status).sort()).toEqual([200,202]);
    expect(db.prepare('SELECT sold_count FROM digital_products').get().sold_count).toBe(1);
    const original = db.prepare('SELECT tx_reference FROM digital_orders').get().tx_reference;
    expect((await verify('game', original)).status).toBe(200);
    expect(()=>db.exec('UPDATE digital_products SET total_editions=2')).toThrow(/edition supply/);
  });
  it('retries competing purchases when editions remain and ignores aggregated D1 change counts', async () => {
    release('game',2); rpc(); aggregateChanges=true;
    const results=await Promise.all([verify(),verify('game','0x'+'5'.repeat(64))]);
    expect(results.map(r=>r.status)).toEqual([200,200]);
    expect(db.prepare('SELECT sold_count FROM digital_products').get().sold_count).toBe(2);
    expect(db.prepare('SELECT edition_number FROM digital_orders ORDER BY edition_number').all().map((r:any)=>r.edition_number)).toEqual([1,2]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM digital_payment_reviews').get().n).toBe(0);
  });
  it('confirms legacy artwork acquisitions even when D1 metadata counts trigger writes', async () => {
    aggregateChanges=true;rpc();db.exec("UPDATE artworks SET is_demo=0,price_cents=1250,fulfillment_uri='https://private.test/art' WHERE id='art_001'");
    const result=await app.request('https://max.test/api/checkout/verify-usdc',{method:'POST',headers:{Origin:'https://max.test','Content-Type':'application/json'},body:JSON.stringify({artworkId:'art_001',txHash:tx,buyerAddress:buyer.address,signature:await buyer.signMessage({message:checkoutMessage('https://max.test','art_001',tx,buyer.address)})})},bindings() as never);
    expect(result.status).toBe(200);expect((await result.json() as any).accessToken).toBeTruthy();
  });
  it('records already-paid sold-out transfers and verifies publisher refunds to the original wallet', async () => {
    release('game',1); rpc(); expect((await verify()).status).toBe(200);
    const lost='0x'+'5'.repeat(64), refund='0x'+'7'.repeat(64);
    const response=await verify('game',lost);expect(response.status).toBe(202);const pending=await response.json() as any;
    expect(pending.status).toBe('pending_refund');expect(pending.caseId).toBeTruthy();
    expect(db.prepare('SELECT COUNT(*) AS n FROM settlement_claims').get().n).toBe(2);
    const noRpc={...bindings(),RPC_URL:undefined};expect((await verify('game',lost,undefined,'https://max.test',noRpc)).status).toBe(202);
    const headers={Origin:'https://max.test','Content-Type':'application/json',Authorization:`Bearer ${await sign({role:'admin',exp:Math.floor(Date.now()/1000)+60},secret,'HS256')}`};
    const resolve=()=>app.request(`https://max.test/api/admin/payment-reviews/${pending.caseId}/refund`,{method:'POST',headers,body:JSON.stringify({txHash:refund})},bindings() as never);
    expect((await app.request('https://max.test/api/admin/payment-reviews',{},bindings() as never)).status).toBe(401);
    expect((await resolve()).status).toBe(403); // Original buyer->treasury transfer is not a refund.
    vi.restoreAllMocks();rpc({eth_getTransactionReceipt:{status:'0x1',blockNumber:'0x62',logs:[{address:contract,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+treasury.slice(2).padStart(64,'0'),'0x'+buyer.address.slice(2).toLowerCase().padStart(64,'0')],data:'0x'+(1250n*10000n).toString(16)}]}});
    expect((await resolve()).status).toBe(200);expect(await (await verify('game',lost,undefined,'https://max.test',noRpc)).json()).toMatchObject({status:'refunded',refundTxHash:refund});
    expect(()=>db.exec('DELETE FROM digital_payment_reviews')).toThrow();
    expect(()=>db.exec("UPDATE digital_payment_reviews SET status='pending_refund',refund_tx_reference=NULL")).toThrow();
  });
  it('records partial payments for refund review without allocating an edition', async () => {
    release();rpc({eth_getTransactionReceipt:{status:'0x1',blockNumber:'0x62',logs:[{address:contract,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+buyer.address.slice(2).toLowerCase().padStart(64,'0'),'0x'+treasury.slice(2).padStart(64,'0')],data:'0x1'}]}});
    expect((await verify()).status).toBe(202);expect(db.prepare('SELECT amount_units FROM digital_payment_reviews').get().amount_units).toBe('1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM digital_orders').get().n).toBe(0);
  });
  it('prevents receipt reuse across digital products and the existing artwork checkout in both directions', async () => {
    release('first'); release('second'); rpc();
    expect((await verify('first')).status).toBe(200); expect((await verify('second')).status).toBe(409);
    expect(db.prepare("SELECT sold_count FROM digital_products WHERE id='second'").get().sold_count).toBe(0);
    db.exec("UPDATE artworks SET is_demo=0,price_cents=1250,fulfillment_uri='https://private.test/art' WHERE id='art_001'");
    const artwork = await app.request('https://max.test/api/checkout/verify-usdc', { method:'POST', headers:{Origin:'https://max.test','Content-Type':'application/json'}, body:JSON.stringify({artworkId:'art_001',txHash:tx,buyerAddress:buyer.address,signature:await buyer.signMessage({message:checkoutMessage('https://max.test','art_001',tx,buyer.address)})}) }, bindings() as never);
    expect(artwork.status).toBe(500); expect(db.prepare("SELECT status FROM artworks WHERE id='art_001'").get().status).toBe('available');
    db.prepare("INSERT INTO transactions(artwork_id,buyer_email,tx_reference,created_at,buyer_wallet) VALUES ('art_001','test@local.test',?,1,?)").run('0x'+'6'.repeat(64),buyer.address.toLowerCase());
    expect((await verify('second','0x'+'6'.repeat(64))).status).toBe(409);
  });
  it('keeps paid delivery and legacy store destinations private and requires content before publication', async () => {
    release();
    const list = await (await app.request('https://max.test/api/catalog', {}, bindings() as never)).json() as any;
    expect(list.products[0].destination_url).toBeNull(); expect(list.products[0].fulfillment_uri).toBeUndefined(); expect(list.products[0].metadata_hash).toBeUndefined(); expect(list.products[0].direct_acquisition).toBe(1);
    const headers = { Origin:'https://max.test','Content-Type':'application/json', Authorization:`Bearer ${await sign({role:'admin',exp:Math.floor(Date.now()/1000)+60},secret,'HS256')}` };
    const input = {kind:'game',title:'Unready',creator:'Test',description:'Test',image_url:'https://cover.test/img',price_cents:1,currency:'USDC',platform:'Web',version:'1',status:'published'};
    expect((await app.request('https://max.test/api/admin/catalog',{method:'POST',headers,body:JSON.stringify(input)},bindings() as never)).status).toBe(400);
    expect((await app.request('https://max.test/api/admin/digital-orders', {}, bindings() as never)).status).toBe(401);
    expect((await app.request('https://max.test/api/admin/digital-orders',{headers},bindings() as never)).status).toBe(200);
  });
  it('guards audit events, settled orders and receipt claims against update and delete', async () => {
    release(); rpc(); expect((await verify()).status).toBe(200);
    for (const [table,column] of [['beemax_ledger_events','action'],['digital_orders','title'],['settlement_claims','asset_id']]) {
      expect(()=>db.exec(`UPDATE ${table} SET ${column}='tamper'`)).toThrow(/append-only/);
      expect(()=>db.exec(`DELETE FROM ${table}`)).toThrow(/append-only/);
    }
  });
});
