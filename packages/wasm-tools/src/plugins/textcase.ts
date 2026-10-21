interface TextCaseInput {
  text: string;
  to: TargetCase;
}

interface TextCaseOutput {
  result: string;
  words: string[];
  error?: string;
}

type TargetCase = 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'title' | 'sentence';

const TARGET_CASES: readonly TargetCase[] = [
  'camel',
  'pascal',
  'snake',
  'kebab',
  'constant',
  'title',
  'sentence',
];

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

/**
 * Digit rule:
 * Digit runs are separate tokens, splitting at letter-digit boundaries ('utf8' -> ['utf', '8'])
 * and digit-letter boundaries ('version2Beta' -> ['version', '2', 'beta']).
 * Digit-to-digit transitions remain in the same token (e.g. '2024' remains a single token).
 *
 * Splitting rules for an alphanumeric chunk:
 * 1. Letter-digit boundary: [a-zA-Z] followed by [0-9] splits ('utf8' -> 'utf' + '8')
 * 2. Digit-letter boundary: [0-9] followed by [a-zA-Z] splits ('version2Beta' -> '2' + 'beta')
 * 3. CamelCase / PascalCase boundary: lowercase followed by uppercase splits ('parseHTTP' -> 'parse' + 'HTTP')
 * 4. Acronym boundary: uppercase followed by uppercase and then lowercase splits
 *    ('parseHTTPResponse' -> 'HTTP' + 'Response', 'XMLHttpRequest' -> 'XML' + 'Http')
 */
function splitChunk(chunk: string): string[] {
  const words: string[] = [];
  let currentWord = '';

  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i];
    currentWord += c;

    if (i < chunk.length - 1) {
      const next = chunk[i + 1];
      const nextNext = i + 2 < chunk.length ? chunk[i + 2] : '';

      const isCurrentDigit = isDigit(c);
      const isNextDigit = isDigit(next);
      const isCurrentLower = isLower(c);
      const isNextUpper = isUpper(next);
      const isCurrentUpper = isUpper(c);
      const isNextNextLower = nextNext ? isLower(nextNext) : false;

      let split = false;

      // Letter-digit boundary: letter followed by digit
      if (!isCurrentDigit && isNextDigit) {
        split = true;
      }
      // Digit-letter boundary: digit followed by letter
      else if (isCurrentDigit && !isNextDigit) {
        split = true;
      }
      // CamelCase / PascalCase boundary: lower followed by upper
      else if (isCurrentLower && isNextUpper) {
        split = true;
      }
      // Acronym boundary: upper followed by upper then lower
      else if (isCurrentUpper && isNextUpper && isNextNextLower) {
        split = true;
      }

      if (split) {
        words.push(currentWord.toLowerCase());
        currentWord = '';
      }
    }
  }

  if (currentWord.length > 0) {
    words.push(currentWord.toLowerCase());
  }

  return words;
}

/**
 * Splits input text into detected lowercase word tokens.
 * Handles whitespace and `_`, `-`, `.`, `/` separators, including repeated
 * and leading/trailing separators, and applies word boundary splitting on alphanumeric segments.
 */
function splitWords(text: string): string[] {
  // Separators: whitespace, _, -, ., / (or any non-alphanumeric character)
  const chunks = text.split(/[^a-zA-Z0-9]+/).filter((c) => c.length > 0);
  const words: string[] = [];

  for (const chunk of chunks) {
    const chunkWords = splitChunk(chunk);
    for (const word of chunkWords) {
      words.push(word);
    }
  }

  return words;
}

function capitalize(word: string): string {
  if (word.length === 0) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Formats an array of lowercase word tokens into the requested target case.
 */
function formatWords(words: string[], targetCase: TargetCase): string {
  if (words.length === 0) {
    return '';
  }

  switch (targetCase) {
    case 'camel':
      return words[0].toLowerCase() + words.slice(1).map(capitalize).join('');
    case 'pascal':
      return words.map(capitalize).join('');
    case 'snake':
      return words.join('_');
    case 'kebab':
      return words.join('-');
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_');
    case 'title':
      return words.map(capitalize).join(' ');
    case 'sentence':
      return capitalize(words[0]) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
    default:
      throw new Error(`Unsupported case "${targetCase}"`);
  }
}

export function textcase(): number {
  try {
    const inputStr = Host.inputString();
    let input: TextCaseInput;
    try {
      input = JSON.parse(inputStr);
    } catch {
      throw new Error('Invalid JSON input');
    }

    if (!input || typeof input !== 'object') {
      throw new Error('Input must be an object');
    }

    if (typeof input.text !== 'string') {
      throw new Error('text must be a string');
    }

    if (!TARGET_CASES.includes(input.to)) {
      throw new Error(
        `Invalid target case "${input.to}". Supported cases: ${TARGET_CASES.join(', ')}`
      );
    }

    const words = splitWords(input.text);
    const result = formatWords(words, input.to);

    const output: TextCaseOutput = {
      result,
      words,
    };

    Host.outputString(JSON.stringify(output));
    return 0;
  } catch (error) {
    const output: TextCaseOutput = {
      result: '',
      words: [],
      error: error instanceof Error ? error.message : String(error),
    };
    Host.outputString(JSON.stringify(output));
    return 1;
  }
}

declare const Host: {
  inputString(): string;
  outputString(s: string): void;
};
