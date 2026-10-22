import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  exactMatch,
  contains,
  containsAll,
  containsAny,
  similarity,
  tokenF1,
  regex,
  jsonSchema,
} from '../metrics/deterministic';
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

describe('containsAll', () => {
  it('scores the fraction of keywords found and lists missing keywords', async () => {
    const score = await containsAll(['alpha', 'beta', 'gamma'])(
      makeResult('Alpha and gamma are present')
    );

    expect(score.score).toBeCloseTo(2 / 3);
    expect(score.details).toBe('missing keywords: "beta"');
  });

  it('scores 1 without details when every keyword is found', async () => {
    const score = await containsAll(['alpha', 'beta'])(makeResult('beta follows alpha'));

    expect(score).toEqual({ name: 'containsAll', score: 1, details: undefined });
  });

  it('respects caseSensitive option', async () => {
    const metric = containsAll(['Alpha', 'Beta'], { caseSensitive: true });

    expect((await metric(makeResult('Alpha and beta'))).score).toBe(0.5);
    expect((await metric(makeResult('Alpha and Beta'))).score).toBe(1);
  });

  it('rejects an empty keyword list', () => {
    expect(() => containsAll([])).toThrow('containsAll requires at least one keyword');
  });

  it('rejects empty and whitespace-only keywords', () => {
    expect(() => containsAll([''])).toThrow('containsAll requires non-empty keywords');
    expect(() => containsAll(['alpha', '   '])).toThrow('containsAll requires non-empty keywords');
  });

  it('ignores duplicate keywords when scoring', async () => {
    const score = await containsAll(['alpha', 'ALPHA', 'beta'])(makeResult('alpha'));

    expect(score.score).toBe(0.5);
    expect(score.details).toBe('missing keywords: "beta"');
  });

  it('supports a custom metric name', async () => {
    const metric = containsAll(['alpha'], { name: 'requiredTerms' });

    expect(metric.metricName).toBe('requiredTerms');
    expect((await metric(makeResult('alpha'))).name).toBe('requiredTerms');
  });
});

describe('containsAny', () => {
  it('scores 1 when at least one keyword is found', async () => {
    const score = await containsAny(['alpha', 'beta'])(makeResult('The answer mentions Beta'));

    expect(score).toEqual({ name: 'containsAny', score: 1, details: undefined });
  });

  it('scores 0 with details when no keyword is found', async () => {
    const score = await containsAny(['alpha', 'beta'])(makeResult('gamma'));

    expect(score.score).toBe(0);
    expect(score.details).toBe('output does not contain any of: "alpha", "beta"');
  });

  it('respects caseSensitive option', async () => {
    const metric = containsAny(['Alpha'], { caseSensitive: true });

    expect((await metric(makeResult('alpha'))).score).toBe(0);
    expect((await metric(makeResult('Alpha'))).score).toBe(1);
  });

  it('rejects an empty keyword list', () => {
    expect(() => containsAny([])).toThrow('containsAny requires at least one keyword');
  });

  it('rejects empty and whitespace-only keywords', () => {
    expect(() => containsAny([''])).toThrow('containsAny requires non-empty keywords');
    expect(() => containsAny(['alpha', '\t'])).toThrow('containsAny requires non-empty keywords');
  });

  it('ignores duplicate keywords in failure details', async () => {
    const score = await containsAny(['alpha', 'ALPHA', 'beta'])(makeResult('gamma'));

    expect(score.details).toBe('output does not contain any of: "alpha", "beta"');
  });

  it('supports a custom metric name', async () => {
    const metric = containsAny(['alpha'], { name: 'optionalTerms' });

    expect(metric.metricName).toBe('optionalTerms');
    expect((await metric(makeResult('alpha'))).name).toBe('optionalTerms');
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

  it('handles Unicode code points and emojis correctly', async () => {
    const metric = similarity();
    const emojiMismatch = await metric(makeResult('😀', '😃'));
    expect(emojiMismatch.score).toBe(0);
    expect(emojiMismatch.details).toBe('expected "😃", got "😀" (distance: 1)');

    const sameEmoji = await metric(makeResult('🎉🚀', '🎉🚀'));
    expect(sameEmoji.score).toBe(1);
    expect(sameEmoji.details).toBeUndefined();

    const partialEmoji = await metric(makeResult('hello 😀', 'hello 😃'));
    expect(partialEmoji.score).toBeCloseTo(1 - 1 / 7);
    expect(partialEmoji.details).toContain('distance: 1');
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

describe('tokenF1', () => {
  it('scores 1 when output tokens match expected tokens identically', async () => {
    const metric = tokenF1();
    const score = await metric(makeResult('hello world', 'hello world'));
    expect(score).toEqual({ name: 'tokenF1', score: 1 });
    expect(score.details).toBeUndefined();
  });

  it('scores 1 for two empty strings without division by zero', async () => {
    const score = await tokenF1()(makeResult('', ''));
    expect(score).toEqual({ name: 'tokenF1', score: 1 });
    expect(score.details).toBeUndefined();
  });

  it('scores 1 for whitespace-only strings', async () => {
    const score = await tokenF1()(makeResult('   ', '  '));
    expect(score).toEqual({ name: 'tokenF1', score: 1 });
    expect(score.details).toBeUndefined();
  });

  it('scores 1 when both strings normalize to empty tokens due to punctuation', async () => {
    const score = await tokenF1()(makeResult('!?', '...'));
    expect(score).toEqual({ name: 'tokenF1', score: 1 });
    expect(score.details).toBeUndefined();
  });

  it('scores 0 with details when expected is undefined', async () => {
    const score = await tokenF1()(makeResult('hello'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('no expected value provided');
  });

  it('scores 0 when output is empty and expected is non-empty', async () => {
    const score = await tokenF1()(makeResult('', 'hello world'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('expected "hello world", got "" (precision: 0, recall: 0)');
  });

  it('scores 0 when output is non-empty and expected is empty', async () => {
    const score = await tokenF1()(makeResult('hello world', ''));
    expect(score.score).toBe(0);
    expect(score.details).toBe('expected "", got "hello world" (precision: 0, recall: 0)');
  });

  it('calculates partial matches correctly', async () => {
    // actual: 'red car' (2 tokens), expected: 'red bike' (2 tokens) -> overlap: 1 ('red')
    // precision = 0.5, recall = 0.5, F1 = 0.5
    const score = await tokenF1()(makeResult('red car', 'red bike'));
    expect(score.score).toBe(0.5);
    expect(score.details).toBe('expected "red bike", got "red car" (precision: 0.5, recall: 0.5)');

    // 'the cat sat' vs 'cat sat down': articles removed -> ['cat', 'sat'] vs ['cat', 'sat', 'down']
    // overlap = 2, precision = 2/2 = 1, recall = 2/3, F1 = 0.8
    const score2 = await tokenF1()(makeResult('the cat sat', 'cat sat down'));
    expect(score2.score).toBeCloseTo(0.8);
    expect(score2.details).toBe(
      'expected "cat sat down", got "the cat sat" (precision: 1, recall: 0.67)'
    );
  });

  it('handles duplicate tokens correctly using multiset counts', async () => {
    // expected has 1 'apple', actual has 3 'apple's -> overlap = 1
    // precision = 1/3, recall = 1/1 = 1, F1 = (2 * 1/3 * 1) / (1/3 + 1) = 0.5
    const score1 = await tokenF1()(makeResult('apple apple apple', 'apple'));
    expect(score1.score).toBe(0.5);
    expect(score1.details).toBe(
      'expected "apple", got "apple apple apple" (precision: 0.33, recall: 1)'
    );

    // expected has 2 'apple's, actual has 1 'apple' -> overlap = 1
    // precision = 1/1 = 1, recall = 1/2 = 0.5, F1 = (2 * 1 * 0.5) / 1.5 = 2/3
    const score2 = await tokenF1()(makeResult('apple', 'apple apple'));
    expect(score2.score).toBeCloseTo(2 / 3);
    expect(score2.details).toBe('expected "apple apple", got "apple" (precision: 1, recall: 0.5)');

    // actual: ['cat', 'cat', 'dog'], expected: ['cat', 'dog', 'dog']
    // overlap: 1 'cat' + 1 'dog' = 2
    // precision = 2/3, recall = 2/3, F1 = 2/3
    const score3 = await tokenF1()(makeResult('cat cat dog', 'cat dog dog'));
    expect(score3.score).toBeCloseTo(2 / 3);
    expect(score3.details).toBe(
      'expected "cat dog dog", got "cat cat dog" (precision: 0.67, recall: 0.67)'
    );
  });

  it('strips standalone articles a, an, and the when tokenizing', async () => {
    const score1 = await tokenF1()(makeResult('the cat sat', 'cat sat down'));
    expect(score1.score).toBeCloseTo(0.8);

    const score2 = await tokenF1()(makeResult('a red bike', 'red bike'));
    expect(score2.score).toBe(1);
    expect(score2.details).toBeUndefined();

    const score3 = await tokenF1()(makeResult('an apple', 'apple'));
    expect(score3.score).toBe(1);
    expect(score3.details).toBeUndefined();
  });

  it('is case-insensitive by default', async () => {
    const score = await tokenF1()(makeResult('Hello World', 'hello world'));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();
  });

  it('respects caseSensitive option', async () => {
    const metric = tokenF1({ caseSensitive: true });
    const diffCase = await metric(makeResult('Hello World', 'hello world'));
    expect(diffCase.score).toBe(0);
    expect(diffCase.details).toBe(
      'expected "hello world", got "Hello World" (precision: 0, recall: 0)'
    );

    const sameCase = await metric(makeResult('Hello World', 'Hello World'));
    expect(sameCase.score).toBe(1);
    expect(sameCase.details).toBeUndefined();
  });

  it('strips punctuation when tokenizing', async () => {
    const score = await tokenF1()(makeResult('Hello, World!', 'hello world'));
    expect(score.score).toBe(1);
    expect(score.details).toBeUndefined();

    const score2 = await tokenF1()(makeResult('About 1,000 people', 'about 1000 people'));
    expect(score2.score).toBe(1);
    expect(score2.details).toBeUndefined();

    const score3 = await tokenF1()(makeResult('the U.S.A.', 'the USA'));
    expect(score3.score).toBe(1);
    expect(score3.details).toBeUndefined();
  });

  it('scores 0 for completely disjoint tokens and includes precision and recall in details', async () => {
    const score = await tokenF1()(makeResult('foo bar', 'baz qux'));
    expect(score.score).toBe(0);
    expect(score.details).toBe('expected "baz qux", got "foo bar" (precision: 0, recall: 0)');
  });

  it('includes precision and recall in details whenever score is below 1', async () => {
    const score = await tokenF1()(makeResult('alpha beta', 'alpha gamma'));
    expect(score.score).toBeLessThan(1);
    expect(score.details).toBe(
      'expected "alpha gamma", got "alpha beta" (precision: 0.5, recall: 0.5)'
    );
  });

  it('passes threshold assertion when tokenF1 is at or above threshold', async () => {
    const metric = tokenF1();
    const scoreResult = await metric(makeResult('red car', 'red bike'));
    expect(scoreResult.score).toBe(0.5);

    const agg: Record<string, AggregatedMetric> = {
      tokenF1: {
        name: 'tokenF1',
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

    const assertionResult = threshold('tokenF1', 0.5)(agg, { total: 1, duration: 10, cost: 0 });
    expect(assertionResult.passed).toBe(true);
    expect(assertionResult.actual).toBe(0.5);
    expect(assertionResult.expected).toBe(0.5);
  });

  it('fails threshold assertion when tokenF1 is below threshold', async () => {
    const metric = tokenF1();
    const scoreResult = await metric(makeResult('red car', 'red bike'));
    expect(scoreResult.score).toBe(0.5);

    const agg: Record<string, AggregatedMetric> = {
      tokenF1: {
        name: 'tokenF1',
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

    const assertionResult = threshold('tokenF1', 0.8)(agg, { total: 1, duration: 10, cost: 0 });
    expect(assertionResult.passed).toBe(false);
    expect(assertionResult.actual).toBe(0.5);
    expect(assertionResult.expected).toBe(0.8);
  });

  it('supports custom metric name', async () => {
    const custom = tokenF1({ name: 'f1Score' });
    expect(custom.metricName).toBe('f1Score');

    const result = await custom(makeResult('hello', 'hello'));
    expect(result.name).toBe('f1Score');
  });

  it('has metricName property defaulting to tokenF1', () => {
    expect(tokenF1().metricName).toBe('tokenF1');
  });
});
