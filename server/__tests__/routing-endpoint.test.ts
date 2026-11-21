import { describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import app from '../planetary-max';

const secret = 'independent-synthetic-test-jwt-secret-123456';
const input = { ingress: 'MAX-INTERNET', intent_type: 'synthesize', multi_module_coordination: true, contains: ['equations'] };

describe('routing endpoint', () => {
  it('requires an administrator and same-origin request, without invoking AI', async () => {
    const bindings = { JWT_SECRET: secret, AI: { run: vi.fn() } };
    const token = await sign({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 }, secret, 'HS256');
    const send = (body: unknown, cookie = '', origin = 'https://max.test') => app.request('https://max.test/api/admin/beemax/route', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body),
    }, bindings as never);
    const cookie = `max_admin=${token}`;
    expect((await send(input)).status).toBe(401);
    expect((await send(input, cookie, 'https://attacker.test')).status).toBe(403);
    expect((await send({ ...input, verified: true }, cookie)).status).toBe(400);
    const response = await send(input, cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ rule_id: 'R3_DEEP_REASONING_AND_SYNTHESIS', verification: 'required', execution: 'not_dispatched' });
    expect(bindings.AI.run).not.toHaveBeenCalled();
  });
});
