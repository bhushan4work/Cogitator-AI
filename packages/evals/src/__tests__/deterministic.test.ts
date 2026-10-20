import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { exactMatch, contains, similarity, regex, jsonSchema } from '../metrics/deterministic';
import { threshold } from '../assertions';
import type { EvalCaseResult } from '../metrics/types';
import type { AggregatedMetric } from '../assertions';

function makeResult(output: string, expected?: string): EvalCaseResult {
  return {
    case: { input: 'test', expected },
    output,
    duration: 100,
  };
}

describe('exactMatch', () => {
  it('scores 1 when output matches expected', async () => {
    const metric = exactMatch();
    const score = await metric(makeResult('hello', 'hello'));
    expect(score).toEqual({ name: 'exactMatch', score: 1 });
  });

  it('scores 0 when output does not match', async () => {
    const score = await exactMatch()(makeResult('hello', 'world'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('expected "world"');
  });

  it('is case-insensitive by default', async () => {
    const score = await exactMatch()(makeResult('Hello World', 'hello world'));
    expect(score.score).toBe(1);
  });

  it('respects caseSensitive option', async () => {
    const metric = exactMatch({ caseSensitive: true });
    expect((await metric(makeResult('Hello', 'hello'))).score).toBe(0);
    expect((await metric(makeResult('Hello', 'Hello'))).score).toBe(1);
  });

  it('trims whitespace before comparing', async () => {
    const score = await exactMatch()(makeResult('  hello  ', 'hello'));
    expect(score.score).toBe(1);
  });

  it('scores 0 with details when expected is undefined', async () => {
    const score = await exactMatch()(makeResult('hello'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('no expected value provided');
  });

  it('handles empty strings', async () => {
    const score = await exactMatch()(makeResult('', ''));
    expect(score.score).toBe(1);
  });

  it('has metricName property', () => {
    expect(exactMatch().metricName).toBe('exactMatch');
  });
});

describe('contains', () => {
  it('scores 1 when output contains expected', async () => {
    const score = await contains()(makeResult('the answer is 42', '42'));
    expect(score.score).toBe(1);
  });

  it('scores 0 when output does not contain expected', async () => {
    const score = await contains()(makeResult('no match here', 'missing'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('does not contain');
  });

  it('is case-insensitive by default', async () => {
    const score = await contains()(makeResult('Hello World', 'hello'));
    expect(score.score).toBe(1);
  });

  it('respects caseSensitive option', async () => {
    const metric = contains({ caseSensitive: true });
    expect((await metric(makeResult('Hello World', 'hello'))).score).toBe(0);
    expect((await metric(makeResult('Hello World', 'Hello'))).score).toBe(1);
  });

  it('scores 0 with details when expected is undefined', async () => {
    const score = await contains()(makeResult('hello'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('no expected value provided');
  });

  it('handles empty substring', async () => {
    const score = await contains()(makeResult('anything', ''));
    expect(score.score).toBe(1);
  });

  it('handles multiline output', async () => {
    const score = await contains()(makeResult('line one\nline two\nline three', 'line two'));
    expect(score.score).toBe(1);
  });

  it('has metricName property', () => {
    expect(contains().metricName).toBe('contains');
  });
});

describe('regex', () => {
  it('scores 1 when output matches pattern', async () => {
    const score = await regex('\\d+')(makeResult('answer is 42'));
    expect(score.score).toBe(1);
  });

  it('scores 0 when output does not match', async () => {
    const score = await regex('^\\d+$')(makeResult('not a number'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('does not match');
  });

  it('accepts RegExp object', async () => {
    const score = await regex(/^yes$/i)(makeResult('Yes'));
    expect(score.score).toBe(1);
  });

  it('accepts string pattern', async () => {
    const score = await regex('^[a-z]+$')(makeResult('hello'));
    expect(score.score).toBe(1);
  });

  it('handles multiline output', async () => {
    const score = await regex(/second/)(makeResult('first\nsecond\nthird'));
    expect(score.score).toBe(1);
  });

  it('has metricName property', () => {
    expect(regex('.*').metricName).toBe('regex');
  });
});

describe('jsonSchema', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it('scores 1 when output is valid JSON matching schema', async () => {
    const score = await jsonSchema(schema)(makeResult('{"name": "Alice", "age": 30}'));
    expect(score.score).toBe(1);
  });

  it('scores 0 when JSON does not match schema', async () => {
    const score = await jsonSchema(schema)(makeResult('{"name": "Alice", "age": "thirty"}'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('schema validation failed');
  });

  it('scores 0 when output is not valid JSON', async () => {
    const score = await jsonSchema(schema)(makeResult('not json'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('invalid JSON');
  });

  it('scores 0 when JSON is missing required fields', async () => {
    const score = await jsonSchema(schema)(makeResult('{"name": "Alice"}'));
    expect(score.score).toBe(0);
    expect(score.details).toContain('schema validation failed');
  });

  it('handles empty object against strict schema', async () => {
    const score = await jsonSchema(schema)(makeResult('{}'));
    expect(score.score).toBe(0);
  });

  it('has metricName property', () => {
    expect(jsonSchema(schema).metricName).toBe('jsonSchema');
  });
});

describe('similarity', () => {
  it('scores 1 when output is identical to expected', async () => {
    const metric = similarity();
    const score = await metric(makeResult('hello', 'hello'));
    expect(score).toEqual({ name: 'similarity', score: 1 });
    expect(score.details).toBeUndefined();
  });

  it('scores 1 for two empty strings without division by zero', async () => {
    const score = await similarity()(makeResult('', ''));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();
  });

  it('scores 1 for whitespace-only strings', async () => {
    const score = await similarity()(makeResult('   ', '  '));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();
  });

  it('scores 0 with details when expected is undefined', async () => {
    const score = await similarity()(makeResult('hello'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('no expected value provided');
  });

  it('is case-insensitive by default', async () => {
    const score = await similarity()(makeResult('Hello World', 'hello world'));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();
  });

  it('respects caseSensitive option', async () => {
    const metric = similarity({ caseSensitive: true });
    const diffCase = await metric(makeResult('Hello', 'hello'));
    // Distance 1 (H vs h), max length 5 => score = 1 - 1/5 = 0.8
    expect(diffCase.score).toBe(0.8);
    expect(diffCase.details).toContain('distance: 1');

    const sameCase = await metric(makeResult('Hello', 'Hello'));
    expect(sameCase.score).toBe(1);
    expect(sameCase.details).toBeUndefined();
  });

  it('trims whitespace before calculating similarity', async () => {
    const score = await similarity()(makeResult('  hello  ', 'hello'));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();

    const scoreWithTypo = await similarity()(makeResult('  helo  ', '  hello  '));
    expect(scoreWithTypo.score).toBe(0.8);
    expect(scoreWithTypo.details).toBe('expected "hello", got "helo" (distance: 1)');
  });

  it('accurately scores typos', async () => {
    // Single-character typo: 1 deletion / insertion / substitution
    const singleTypo = await similarity()(makeResult('helo', 'hello'));
    expect(singleTypo.score).toBe(0.8);
    expect(singleTypo.details).toContain('distance: 1');

    // Multi-character edit: kitten -> sitting (sub k->s, sub e->i, add g: distance 3, maxLen 7)
    const multiTypo = await similarity()(makeResult('kitten', 'sitting'));
    expect(multiTypo.score).toBeCloseTo(1 - 3 / 7);
    expect(multiTypo.details).toContain('distance: 3');
  });

  it('scores 0 or near 0 for unrelated strings', async () => {
    // Completely disjoint strings: distance = maxLen => score = 0
    const disjoint = await similarity()(makeResult('abc', 'xyz'));
    expect(disjoint.score).toBe(0);
    expect(disjoint.details).toBe('expected "xyz", got "abc" (distance: 3)');

    const unrelated = await similarity()(makeResult('apple', 'banana'));
    // apple vs banana: distance 5, maxLen 6 => score 1/6
    expect(unrelated.score).toBeCloseTo(1 / 6);
    expect(unrelated.details).toContain('distance: 5');
  });

  it('calculates score based on insertions, deletions, and substitutions', async () => {
    // Substitution
    const sub = await similarity()(makeResult('cat', 'bat'));
    expect(sub.score).toBeCloseTo(2 / 3);
    expect(sub.details).toContain('distance: 1');

    // Insertion
    const ins = await similarity()(makeResult('cat', 'cats'));
    expect(ins.score).toBe(0.75);
    expect(ins.details).toContain('distance: 1');

    // Deletion
    const del = await similarity()(makeResult('cats', 'cat'));
    expect(del.score).toBe(0.75);
    expect(del.details).toContain('distance: 1');

    // Empty output vs non-empty expected
    const emptyOutput = await similarity()(makeResult('', 'abc'));
    expect(emptyOutput.score).toBe(0);
    expect(emptyOutput.details).toContain('distance: 3');

    // Non-empty output vs empty expected
    const emptyExpected = await similarity()(makeResult('abc', ''));
    expect(emptyExpected.score).toBe(0);
    expect(emptyExpected.details).toContain('distance: 3');
  });

  it('includes distance in details whenever score is below 1', async () => {
    const res = await similarity()(makeResult('kitten', 'sitting'));
    expect(res.score).toBeLessThan(1);
    expect(res.details).toBe('expected "sitting", got "kitten" (distance: 3)');
  });

  it('passes threshold assertion when similarity is at least 0.8', async () => {
    const metric = similarity();
    const scoreResult = await metric(makeResult('helo', 'hello'));
    expect(scoreResult.score).toBe(0.8);

    const agg: Record<string, AggregatedMetric> = {
      similarity: {
        name: 'similarity',
        mean: scoreResult.score,
        median: scoreResult.score,
        min: scoreResult.score,
        max: scoreResult.score,
        stdDev: 0,
        p50: scoreResult.score,
        p95: scoreResult.score,
        p99: scoreResult.score,
      },
    };

    const assertionResult = threshold('similarity', 0.8)(agg, { total: 1, duration: 10, cost: 0 });
    expect(assertionResult.passed).toBe(true);
    expect(assertionResult.actual).toBe(0.8);
    expect(assertionResult.expected).toBe(0.8);
  });

  it('fails threshold assertion when similarity is below 0.8', async () => {
    const metric = similarity();
    const scoreResult = await metric(makeResult('hel', 'hello'));
    expect(scoreResult.score).toBe(0.6);

    const agg: Record<string, AggregatedMetric> = {
      similarity: {
        name: 'similarity',
        mean: scoreResult.score,
        median: scoreResult.score,
        min: scoreResult.score,
        max: scoreResult.score,
        stdDev: 0,
        p50: scoreResult.score,
        p95: scoreResult.score,
        p99: scoreResult.score,
      },
    };

    const assertionResult = threshold('similarity', 0.8)(agg, { total: 1, duration: 10, cost: 0 });
    expect(assertionResult.passed).toBe(false);
    expect(assertionResult.actual).toBe(0.6);
    expect(assertionResult.expected).toBe(0.8);
  });

  it('supports custom metric name', async () => {
    const custom = similarity({ name: 'levenshteinSim' });
    expect(custom.metricName).toBe('levenshteinSim');

    const result = await custom(makeResult('hello', 'hello'));
    expect(result.name).toBe('levenshteinSim');
  });

  it('has metricName property defaulting to similarity', () => {
    expect(similarity().metricName).toBe('similarity');
  });
});
