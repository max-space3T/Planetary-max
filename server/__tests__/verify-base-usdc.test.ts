import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyBaseUsdcTransfer } from '../verify-base-usdc';

afterEach(() => vi.restoreAllMocks());

const recipient = '0x1111111111111111111111111111111111111111';
const sender = '0x2222222222222222222222222222222222222222';
const contract = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const addressTopic = (address: string) => `0x${address.slice(2).padStart(64, '0')}`;

describe('Base USDC verification', () => {
  it('only verifies a successful canonical-token transfer to the quoted recipient from the signed payer', async () => {
    const receipt = { status: '0x1', blockNumber: '0x10', logs: [{ address: contract, topics: [topic, addressTopic(sender), addressTopic(recipient)], data: `0x${15_000_000n.toString(16)}` }] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const { method } = JSON.parse(String(init?.body)) as { method: string };
      return Response.json({ result: method === 'eth_chainId' ? '0x2105' : receipt });
    });
    const result = await verifyBaseUsdcTransfer({ rpcUrl: 'https://rpc.test', txHash: `0x${'a'.repeat(64)}`, expectedRecipient: recipient, expectedSender: sender, expectedAmountUsdc: '15.000000', expectedContract: contract });
    expect(result.verified).toBe(true);
    expect(result.matchedAmountUsdc).toBe('15.000000');
  });

  it('does not count another wallet’s transfer toward the signed payer amount', async () => {
    const receipt = { status: '0x1', blockNumber: '0x10', logs: [{ address: contract, topics: [topic, addressTopic(recipient), addressTopic(recipient)], data: `0x${15_000_000n.toString(16)}` }] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const { method } = JSON.parse(String(init?.body)) as { method: string };
      return Response.json({ result: method === 'eth_chainId' ? '0x2105' : receipt });
    });
    const result = await verifyBaseUsdcTransfer({ rpcUrl: 'https://rpc.test', txHash: `0x${'a'.repeat(64)}`, expectedRecipient: recipient, expectedSender: sender, expectedAmountUsdc: '15.000000', expectedContract: contract });
    expect(result.verified).toBe(false);
    expect(result.matchedAmountUsdc).toBe('0.000000');
  });
});
