import { describe, it, expect } from 'vitest';
import {
  generatePairingCode,
  parsePairCommand,
  isPairCommand,
  prunePending,
  findPendingByUser,
  PAIRING_ALPHABET,
  type PendingPairing,
} from '../middleware/pairing-codes';

describe('pairing-codes', () => {
  describe('generatePairingCode', () => {
    it('generates a pairing code with the configured length', () => {
      const lengths = [4, 6, 8, 12, 16];
      for (const len of lengths) {
        const code = generatePairingCode(len);
        expect(code).toHaveLength(len);
      }
    });

    it('restricts characters to PAIRING_ALPHABET', () => {
      const alphabetChars = new Set(PAIRING_ALPHABET);
      for (let i = 0; i < 20; i++) {
        const code = generatePairingCode(10);
        for (const char of code) {
          expect(alphabetChars.has(char)).toBe(true);
        }
      }
    });

    it('does not contain ambiguous characters', () => {
      for (let i = 0; i < 20; i++) {
        const code = generatePairingCode(16);
        expect(code).not.toMatch(/[01IO]/);
      }
    });

    it('produces distinct codes over multiple invocations', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 25; i++) {
        codes.add(generatePairingCode(8));
      }
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('parsePairCommand', () => {
    it('parses normal /pair command input', () => {
      expect(parsePairCommand('/pair ABC123')).toBe('ABC123');
      expect(parsePairCommand('/pair K9XYZ4')).toBe('K9XYZ4');
    });

    it('normalizes lowercase codes to uppercase', () => {
      expect(parsePairCommand('/pair abc123')).toBe('ABC123');
      expect(parsePairCommand('/pair k9xyz4')).toBe('K9XYZ4');
      expect(parsePairCommand('/pair AbC12x')).toBe('ABC12X');
    });

    it('handles extra spaces around and between tokens', () => {
      expect(parsePairCommand('  /pair   ABC123  ')).toBe('ABC123');
      expect(parsePairCommand('/pair     K9XYZ4   ')).toBe('K9XYZ4');
      expect(parsePairCommand('   /pair   abc123')).toBe('ABC123');
    });

    it('handles /pair@bot CODE format', () => {
      expect(parsePairCommand('/pair@mybot ABC123')).toBe('ABC123');
      expect(parsePairCommand('/pair@CogitatorBot abc123')).toBe('ABC123');
      expect(parsePairCommand('  /pair@bot_123   XYZ987  ')).toBe('XYZ987');
    });

    it('returns null for missing code or invalid format', () => {
      expect(parsePairCommand('/pair')).toBeNull();
      expect(parsePairCommand('/pair   ')).toBeNull();
      expect(parsePairCommand('/pair@bot')).toBeNull();
      expect(parsePairCommand('')).toBeNull();
      expect(parsePairCommand('   ')).toBeNull();
      expect(parsePairCommand('/help')).toBeNull();
      expect(parsePairCommand('hello /pair ABC123')).toBeNull();
      expect(parsePairCommand('/pairing ABC123')).toBeNull();
      expect(parsePairCommand('/repair ABC123')).toBeNull();
      expect(parsePairCommand('/pair ABC DEF')).toBeNull();
    });
  });

  describe('isPairCommand', () => {
    it('returns true for valid /pair commands', () => {
      expect(isPairCommand('/pair')).toBe(true);
      expect(isPairCommand('/pair ABC123')).toBe(true);
      expect(isPairCommand('  /pair ABC123  ')).toBe(true);
      expect(isPairCommand('/pair@bot')).toBe(true);
      expect(isPairCommand('/pair@my_bot 123')).toBe(true);
      expect(isPairCommand('/pair@bot\tABC')).toBe(true);
      expect(isPairCommand('/PAIR 123')).toBe(true);
      expect(isPairCommand('/Pair@Bot ABC')).toBe(true);
    });

    it('returns false for non-pair text', () => {
      expect(isPairCommand('')).toBe(false);
      expect(isPairCommand('   ')).toBe(false);
      expect(isPairCommand('/pairing')).toBe(false);
      expect(isPairCommand('/repair')).toBe(false);
      expect(isPairCommand('/pair_bot')).toBe(false);
      expect(isPairCommand('hello /pair')).toBe(false);
      expect(isPairCommand('/help')).toBe(false);
    });
  });

  describe('prunePending', () => {
    it('removes entries where expiresAt <= now and preserves unexpired entries', () => {
      const pending = new Map<string, PendingPairing>([
        ['CODE1', { code: 'CODE1', userId: 'u1', channelType: 'telegram', expiresAt: 900 }],
        ['CODE2', { code: 'CODE2', userId: 'u2', channelType: 'telegram', expiresAt: 1000 }],
        ['CODE3', { code: 'CODE3', userId: 'u3', channelType: 'telegram', expiresAt: 1001 }],
        ['CODE4', { code: 'CODE4', userId: 'u4', channelType: 'telegram', expiresAt: 2000 }],
      ]);

      prunePending(pending, 1000);

      expect(pending.has('CODE1')).toBe(false);
      expect(pending.has('CODE2')).toBe(false);
      expect(pending.has('CODE3')).toBe(true);
      expect(pending.has('CODE4')).toBe(true);
      expect(pending.size).toBe(2);
    });

    it('handles empty map without error', () => {
      const pending = new Map<string, PendingPairing>();
      prunePending(pending, Date.now());
      expect(pending.size).toBe(0);
    });

    it('removes all entries when all are expired', () => {
      const pending = new Map<string, PendingPairing>([
        ['CODE1', { code: 'CODE1', userId: 'u1', channelType: 'telegram', expiresAt: 500 }],
        ['CODE2', { code: 'CODE2', userId: 'u2', channelType: 'telegram', expiresAt: 600 }],
      ]);
      prunePending(pending, 1000);
      expect(pending.size).toBe(0);
    });

    it('retains all entries when none are expired', () => {
      const pending = new Map<string, PendingPairing>([
        ['CODE1', { code: 'CODE1', userId: 'u1', channelType: 'telegram', expiresAt: 1500 }],
        ['CODE2', { code: 'CODE2', userId: 'u2', channelType: 'telegram', expiresAt: 1600 }],
      ]);
      prunePending(pending, 1000);
      expect(pending.size).toBe(2);
    });
  });

  describe('findPendingByUser', () => {
    it('returns the matching pending pairing by channelType:userId userKey', () => {
      const alice: PendingPairing = {
        code: 'ALICE1',
        userId: 'alice',
        channelType: 'telegram',
        expiresAt: 5000,
      };
      const bob: PendingPairing = {
        code: 'BOB123',
        userId: 'bob',
        channelType: 'discord',
        expiresAt: 5000,
      };
      const pending = new Map<string, PendingPairing>([
        ['ALICE1', alice],
        ['BOB123', bob],
      ]);

      expect(findPendingByUser(pending, 'telegram:alice')).toBe(alice);
      expect(findPendingByUser(pending, 'discord:bob')).toBe(bob);
    });

    it('returns undefined when userKey is not found', () => {
      const alice: PendingPairing = {
        code: 'ALICE1',
        userId: 'alice',
        channelType: 'telegram',
        expiresAt: 5000,
      };
      const pending = new Map<string, PendingPairing>([['ALICE1', alice]]);

      expect(findPendingByUser(pending, 'discord:alice')).toBeUndefined();
      expect(findPendingByUser(pending, 'telegram:charlie')).toBeUndefined();
    });

    it('returns undefined for empty map', () => {
      const pending = new Map<string, PendingPairing>();
      expect(findPendingByUser(pending, 'telegram:alice')).toBeUndefined();
    });
  });
});
