import { describe, it, expect, vi } from 'vitest';
import { PairingMiddleware, pairing } from '../middleware/pairing';
import { RateLimitMiddleware, rateLimit } from '../middleware/rate-limit';
import type { ChannelMessage, MiddlewareContext, Channel } from '@cogitator-ai/types';

function createMsg(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: 'msg_1',
    channelType: 'telegram',
    channelId: 'ch_1',
    userId: 'user_1',
    text: 'Hello',
    raw: {},
    ...overrides,
  };
}

function createCtx(): MiddlewareContext {
  const store = new Map<string, unknown>();
  return {
    threadId: 'thread_1',
    user: { id: 'user_1', channelType: 'telegram' },
    channel: {
      type: 'telegram',
      start: vi.fn(),
      stop: vi.fn(),
      onMessage: vi.fn(),
      sendText: vi.fn().mockResolvedValue('sent_1'),
      editText: vi.fn(),
      sendFile: vi.fn(),
      sendTyping: vi.fn(),
    } as Channel,
    set: (k: string, v: unknown) => store.set(k, v),
    get: <T>(k: string) => store.get(k) as T | undefined,
  };
}

describe('PairingMiddleware', () => {
  it('allows owner through immediately', async () => {
    const mw = new PairingMiddleware({
      ownerIds: { telegram: 'owner_1' },
    });

    const next = vi.fn();
    await mw.handle(createMsg({ userId: 'owner_1' }), createCtx(), next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks unknown users', async () => {
    const mw = new PairingMiddleware({
      ownerIds: { telegram: 'owner_1' },
    });

    const ctx = createCtx();
    const next = vi.fn();
    await mw.handle(createMsg({ userId: 'stranger' }), ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.channel.sendText).toHaveBeenCalled();
  });

  it('approves user with valid code', async () => {
    const mw = new PairingMiddleware({
      ownerIds: { telegram: 'owner_1' },
    });

    const ctx = createCtx();
    const strangerNext = vi.fn();
    await mw.handle(createMsg({ userId: 'stranger' }), ctx, strangerNext);

    expect(strangerNext).not.toHaveBeenCalled();

    const sendTextCall = (ctx.channel.sendText as ReturnType<typeof vi.fn>).mock.calls[0];
    const codeMatch = /`\/pair (.+?)`/.exec(sendTextCall[1] as string);
    expect(codeMatch).toBeTruthy();
    const code = codeMatch![1];

    const ownerCtx = createCtx();
    const ownerNext = vi.fn();
    await mw.handle(createMsg({ userId: 'owner_1', text: `/pair ${code}` }), ownerCtx, ownerNext);

    expect(mw.isApproved('telegram', 'stranger')).toBe(true);

    const approvedNext = vi.fn();
    await mw.handle(createMsg({ userId: 'stranger' }), createCtx(), approvedNext);
    expect(approvedNext).toHaveBeenCalled();
  });

  it('rejects invalid code', async () => {
    const mw = new PairingMiddleware({
      ownerIds: { telegram: 'owner_1' },
    });

    const ctx = createCtx();
    await mw.handle(createMsg({ userId: 'owner_1', text: '/pair INVALID' }), ctx, vi.fn());

    expect(ctx.channel.sendText).toHaveBeenCalledWith('ch_1', 'Invalid or expired pairing code.');
  });

  describe('constructor validation', () => {
    it('accepts valid codeLength and preserves default behavior when omitted', () => {
      const mwDefault = new PairingMiddleware({
        ownerIds: { telegram: 'owner_1' },
      });
      expect(mwDefault).toBeDefined();

      const mwValid = new PairingMiddleware({
        ownerIds: { telegram: 'owner_1' },
        codeLength: 8,
      });
      expect(mwValid).toBeDefined();

      const mwFactory = pairing({
        ownerIds: { telegram: 'owner_1' },
        codeLength: 10,
      });
      expect(mwFactory).toBeDefined();
    });

    it('rejects invalid codeLength values at middleware creation time', () => {
      const invalidValues = [
        0,
        -1,
        -10,
        NaN,
        3.5,
        0.5,
        '8' as any,
        null as any,
        Infinity,
        -Infinity,
      ];

      for (const val of invalidValues) {
        expect(
          () => new PairingMiddleware({ ownerIds: { telegram: 'owner_1' }, codeLength: val }),
          `Expected codeLength=${String(val)} to throw at creation time`
        ).toThrow(new RegExp(`Invalid codeLength: ${String(val)}`));

        expect(
          () => pairing({ ownerIds: { telegram: 'owner_1' }, codeLength: val }),
          `Expected pairing({ codeLength: ${String(val)} }) to throw at creation time`
        ).toThrow(new RegExp(`Invalid codeLength: ${String(val)}`));
      }
    });

    it('proves errors occur at construction rather than during message handling', async () => {
      let mw: PairingMiddleware | undefined;
      expect(() => {
        mw = new PairingMiddleware({ ownerIds: { telegram: 'owner_1' }, codeLength: 0 });
      }).toThrow(/Invalid codeLength: 0/);
      expect(mw).toBeUndefined();
    });

    it('accepts valid expiresIn and preserves default behavior when omitted', () => {
      const mwDefault = new PairingMiddleware({
        ownerIds: { telegram: 'owner_1' },
      });
      expect(mwDefault).toBeDefined();

      const mwValid = new PairingMiddleware({
        ownerIds: { telegram: 'owner_1' },
        expiresIn: 60,
      });
      expect(mwValid).toBeDefined();

      const mwValidFloat = new PairingMiddleware({
        ownerIds: { telegram: 'owner_1' },
        expiresIn: 0.5,
      });
      expect(mwValidFloat).toBeDefined();

      const mwFactory = pairing({
        ownerIds: { telegram: 'owner_1' },
        expiresIn: 120,
      });
      expect(mwFactory).toBeDefined();
    });

    it('rejects invalid expiresIn values at middleware creation time', () => {
      const invalidValues = [0, -1, -60, NaN, Infinity, -Infinity, '60' as any, null as any];

      for (const val of invalidValues) {
        expect(
          () => new PairingMiddleware({ ownerIds: { telegram: 'owner_1' }, expiresIn: val }),
          `Expected expiresIn=${String(val)} to throw at creation time`
        ).toThrow(new RegExp(`Invalid expiresIn: ${String(val)}`));

        expect(
          () => pairing({ ownerIds: { telegram: 'owner_1' }, expiresIn: val }),
          `Expected pairing({ expiresIn: ${String(val)} }) to throw at creation time`
        ).toThrow(new RegExp(`Invalid expiresIn: ${String(val)}`));
      }
    });

    it('proves expiresIn errors occur at construction rather than during message handling', async () => {
      let mw: PairingMiddleware | undefined;
      expect(() => {
        mw = new PairingMiddleware({ ownerIds: { telegram: 'owner_1' }, expiresIn: 0 });
      }).toThrow(/Invalid expiresIn: 0/);
      expect(mw).toBeUndefined();

      expect(() => {
        mw = new PairingMiddleware({ ownerIds: { telegram: 'owner_1' }, expiresIn: -10 });
      }).toThrow(/Invalid expiresIn: -10/);
      expect(mw).toBeUndefined();
    });
  });
});

describe('RateLimitMiddleware', () => {
  it('allows messages within limit', async () => {
    const mw = new RateLimitMiddleware({ maxPerMinute: 5 });
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      await mw.handle(createMsg(), createCtx(), next);
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  it('blocks messages exceeding limit', async () => {
    const mw = new RateLimitMiddleware({ maxPerMinute: 2 });
    const next = vi.fn();
    const ctx = createCtx();

    await mw.handle(createMsg(), ctx, next);
    await mw.handle(createMsg(), ctx, next);
    await mw.handle(createMsg(), ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx.channel.sendText).toHaveBeenCalledTimes(1);
  });

  it('custom rate limit message', async () => {
    const mw = new RateLimitMiddleware({
      maxPerMinute: 1,
      message: 'Slow down!',
    });

    const ctx = createCtx();
    await mw.handle(createMsg(), ctx, vi.fn());
    await mw.handle(createMsg(), ctx, vi.fn());

    expect(ctx.channel.sendText).toHaveBeenCalledWith('ch_1', 'Slow down!');
  });

  describe('constructor validation', () => {
    it('accepts valid maxPerMinute positive integers', () => {
      const mwValid = new RateLimitMiddleware({ maxPerMinute: 60 });
      expect(mwValid).toBeDefined();

      const mwFactory = rateLimit({ maxPerMinute: 10 });
      expect(mwFactory).toBeDefined();
    });

    it('rejects invalid maxPerMinute values at middleware creation time', () => {
      const invalidValues = [
        0,
        -1,
        -10,
        undefined as any,
        NaN,
        2.5,
        0.5,
        '10' as any,
        null as any,
        Infinity,
        -Infinity,
      ];

      for (const val of invalidValues) {
        expect(
          () => new RateLimitMiddleware({ maxPerMinute: val }),
          `Expected maxPerMinute=${String(val)} to throw at creation time`
        ).toThrow(new RegExp(`Invalid maxPerMinute: ${String(val)}`));

        expect(
          () => rateLimit({ maxPerMinute: val }),
          `Expected rateLimit({ maxPerMinute: ${String(val)} }) to throw at creation time`
        ).toThrow(new RegExp(`Invalid maxPerMinute: ${String(val)}`));
      }

      expect(() => new RateLimitMiddleware({} as any)).toThrow(/Invalid maxPerMinute: undefined/);
      expect(() => rateLimit({} as any)).toThrow(/Invalid maxPerMinute: undefined/);
    });

    it('proves errors occur at construction rather than during message handling', async () => {
      let mw: RateLimitMiddleware | undefined;
      expect(() => {
        mw = new RateLimitMiddleware({ maxPerMinute: 0 });
      }).toThrow(/Invalid maxPerMinute: 0/);
      expect(mw).toBeUndefined();

      expect(() => {
        mw = new RateLimitMiddleware({ maxPerMinute: -5 });
      }).toThrow(/Invalid maxPerMinute: -5/);
      expect(mw).toBeUndefined();

      expect(() => {
        mw = new RateLimitMiddleware({} as any);
      }).toThrow(/Invalid maxPerMinute: undefined/);
      expect(mw).toBeUndefined();
    });
  });
});
