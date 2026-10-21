import type { ZodType } from 'zod';
import type { MetricFn, MetricOptions } from './types';

interface MatchOptions extends MetricOptions {
  caseSensitive?: boolean;
}

function createMetricFn(name: string, fn: MetricFn): MetricFn {
  fn.metricName = name;
  return fn;
}

interface KeywordTarget {
  original: string;
  search: string;
}

function prepareKeywordTargets(
  metricName: 'containsAll' | 'containsAny',
  keywords: string[],
  caseSensitive: boolean
): KeywordTarget[] {
  if (keywords.length === 0) {
    throw new Error(`${metricName} requires at least one keyword`);
  }

  const targets: KeywordTarget[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    if (keyword.trim().length === 0) {
      throw new Error(`${metricName} requires non-empty keywords`);
    }

    const search = caseSensitive ? keyword : keyword.toLowerCase();
    if (!seen.has(search)) {
      seen.add(search);
      targets.push({ original: keyword, search });
    }
  }

  return targets;
}

export function exactMatch(opts?: MatchOptions): MetricFn {
  const caseSensitive = opts?.caseSensitive ?? false;
  const name = opts?.name ?? 'exactMatch';

  return createMetricFn(name, (async (result) => {
    const expected = result.case.expected;
    if (expected === undefined) {
      return { name, score: 0, details: 'no expected value provided' };
    }

    const output = result.output.trim();
    const target = expected.trim();
    const match = caseSensitive ? output === target : output.toLowerCase() === target.toLowerCase();

    return {
      name,
      score: match ? 1 : 0,
      details: match ? undefined : `expected "${target}", got "${output}"`,
    };
  }) as MetricFn);
}

function levenshteinDistance(s1: readonly string[], s2: readonly string[]): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const char1 = s1[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = char1 === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  return prev[n];
}

export function similarity(opts?: MatchOptions): MetricFn {
  const caseSensitive = opts?.caseSensitive ?? false;
  const name = opts?.name ?? 'similarity';

  return createMetricFn(name, (async (result) => {
    const expected = result.case.expected;
    if (expected === undefined) {
      return { name, score: 0, details: 'no expected value provided' };
    }

    const output = result.output.trim();
    const target = expected.trim();

    const s1 = caseSensitive ? output : output.toLowerCase();
    const s2 = caseSensitive ? target : target.toLowerCase();

    const outChars = [...s1];
    const expChars = [...s2];

    const maxLen = Math.max(outChars.length, expChars.length);
    if (maxLen === 0) {
      return { name, score: 1 };
    }

    const distance = levenshteinDistance(outChars, expChars);
    const score = 1 - distance / maxLen;

    return {
      name,
      score,
      details:
        score < 1 ? `expected "${target}", got "${output}" (distance: ${distance})` : undefined,
    };
  }) as MetricFn);
}

export function contains(opts?: MatchOptions): MetricFn {
  const caseSensitive = opts?.caseSensitive ?? false;
  const name = opts?.name ?? 'contains';

  return createMetricFn(name, (async (result) => {
    const expected = result.case.expected;
    if (expected === undefined) {
      return { name, score: 0, details: 'no expected value provided' };
    }

    const output = caseSensitive ? result.output : result.output.toLowerCase();
    const target = caseSensitive ? expected : expected.toLowerCase();
    const found = output.includes(target);

    return {
      name,
      score: found ? 1 : 0,
      details: found ? undefined : `output does not contain "${expected}"`,
    };
  }) as MetricFn);
}

/** Scores the fraction of keywords found in the output. */
export function containsAll(keywords: string[], opts?: MatchOptions): MetricFn {
  const caseSensitive = opts?.caseSensitive ?? false;
  const name = opts?.name ?? 'containsAll';
  const targets = prepareKeywordTargets('containsAll', keywords, caseSensitive);

  return createMetricFn(name, (async (result) => {
    const output = caseSensitive ? result.output : result.output.toLowerCase();
    const missing = targets.filter((keyword) => !output.includes(keyword.search));

    return {
      name,
      score: (targets.length - missing.length) / targets.length,
      details:
        missing.length > 0
          ? `missing keywords: ${missing.map((keyword) => JSON.stringify(keyword.original)).join(', ')}`
          : undefined,
    };
  }) as MetricFn);
}

/** Scores 1 when the output contains at least one keyword, and 0 otherwise. */
export function containsAny(keywords: string[], opts?: MatchOptions): MetricFn {
  const caseSensitive = opts?.caseSensitive ?? false;
  const name = opts?.name ?? 'containsAny';
  const targets = prepareKeywordTargets('containsAny', keywords, caseSensitive);

  return createMetricFn(name, (async (result) => {
    const output = caseSensitive ? result.output : result.output.toLowerCase();
    const found = targets.some((keyword) => output.includes(keyword.search));

    return {
      name,
      score: found ? 1 : 0,
      details: found
        ? undefined
        : `output does not contain any of: ${targets.map((keyword) => JSON.stringify(keyword.original)).join(', ')}`,
    };
  }) as MetricFn);
}

/**
 * Scores 1 when the output matches `pattern`. The `g` and `y` flags are dropped: they make
 * `RegExp.test` resume from the previous match, so identical outputs would alternate between
 * pass and fail.
 */
export function regex(pattern: string | RegExp, opts?: MetricOptions): MetricFn {
  const source = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const re = new RegExp(source.source, source.flags.replace(/[gy]/g, ''));
  const name = opts?.name ?? 'regex';

  return createMetricFn(name, (async (result) => {
    const match = re.test(result.output);
    return {
      name,
      score: match ? 1 : 0,
      details: match ? undefined : `output does not match pattern ${source}`,
    };
  }) as MetricFn);
}

export function jsonSchema(schema: ZodType, opts?: MetricOptions): MetricFn {
  const name = opts?.name ?? 'jsonSchema';

  return createMetricFn(name, (async (result) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.output);
    } catch (e) {
      return {
        name,
        score: 0,
        details: `invalid JSON: ${(e as Error).message}`,
      };
    }

    const validation = schema.safeParse(parsed);
    if (validation.success) {
      return { name, score: 1 };
    }

    return {
      name,
      score: 0,
      details: `schema validation failed: ${validation.error.message}`,
    };
  }) as MetricFn);
}
