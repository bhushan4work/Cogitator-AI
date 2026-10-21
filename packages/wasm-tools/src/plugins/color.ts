interface ColorInput {
  operation?: 'convert' | 'contrast';
  color?: string;
  color1?: string;
  color2?: string;
  foreground?: string;
  background?: string;
  input?: string;
  text?: string;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

interface TextAccessibilityResult {
  aa: boolean;
  aaa: boolean;
}

interface LevelAccessibilityResult {
  normal: boolean;
  large: boolean;
  normalText?: boolean;
  largeText?: boolean;
}

interface ColorOutput {
  hex?: string;
  rgb?: RgbColor;
  hsl?: HslColor;
  ratio?: number;
  contrastRatio?: number;
  normalText?: TextAccessibilityResult;
  largeText?: TextAccessibilityResult;
  aa?: LevelAccessibilityResult;
  aaa?: LevelAccessibilityResult;
  error?: string;
}

function parseColor(rawInput: unknown): RgbColor {
  if (typeof rawInput !== 'string') {
    throw new Error('Color input must be a string');
  }
  const str = rawInput.trim();
  if (str.length === 0) {
    throw new Error('Color string cannot be empty');
  }
  const lower = str.toLowerCase();

  // 1. HEX format: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (lower.startsWith('#')) {
    const hex = lower.slice(1);
    if (!/^[0-9a-f]+$/i.test(hex)) {
      throw new Error(`Invalid hex color: contains non-hex characters: #${hex}`);
    }
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: Math.round((parseInt(hex[3] + hex[3], 16) / 255) * 100) / 100,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: Math.round((parseInt(hex.slice(6, 8), 16) / 255) * 100) / 100,
      };
    }
    throw new Error(`Invalid hex color: expected 3, 4, 6, or 8 characters, got ${hex.length}`);
  }

  // 2. RGB / RGBA format
  const rgbMatch = /^rgba?\s*\((.+)\)$/.exec(lower);
  if (rgbMatch) {
    const inner = rgbMatch[1].trim();
    let tokens: string[];
    if (inner.includes('/')) {
      const slashParts = inner.split('/');
      if (slashParts.length !== 2) {
        throw new Error(`Invalid rgb/rgba syntax with slash: ${str}`);
      }
      const rgbParts = slashParts[0]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      tokens = [...rgbParts, slashParts[1].trim()];
    } else if (inner.includes(',')) {
      tokens = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      tokens = inner.split(/\s+/).filter(Boolean);
    }

    if (tokens.length !== 3 && tokens.length !== 4) {
      throw new Error(`Invalid rgb/rgba format: expected 3 or 4 components, got ${tokens.length}`);
    }

    const rgbValues: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = tokens[i];
      if (t.endsWith('%')) {
        const num = Number(t.slice(0, -1));
        if (Number.isNaN(num) || num < 0 || num > 100) {
          throw new Error(`RGB percentage must be between 0% and 100%: ${t}`);
        }
        rgbValues.push(Math.round((num / 100) * 255));
      } else {
        const num = Number(t);
        if (Number.isNaN(num) || num < 0 || num > 255) {
          throw new Error(`RGB values must be between 0 and 255: ${t}`);
        }
        rgbValues.push(Math.round(num));
      }
    }

    let a = 1;
    if (tokens.length === 4) {
      const aToken = tokens[3];
      if (aToken.endsWith('%')) {
        const aNum = Number(aToken.slice(0, -1));
        if (Number.isNaN(aNum) || aNum < 0 || aNum > 100) {
          throw new Error(`Alpha percentage must be between 0% and 100%: ${aToken}`);
        }
        a = Math.round((aNum / 100) * 100) / 100;
      } else {
        const aNum = Number(aToken);
        if (Number.isNaN(aNum) || aNum < 0 || aNum > 1) {
          throw new Error(`Alpha must be between 0 and 1: ${aToken}`);
        }
        a = Math.round(aNum * 100) / 100;
      }
    }

    return {
      r: rgbValues[0],
      g: rgbValues[1],
      b: rgbValues[2],
      a,
    };
  }

  // 3. HSL / HSLA format
  const hslMatch = /^hsla?\s*\((.+)\)$/.exec(lower);
  if (hslMatch) {
    const inner = hslMatch[1].trim();
    let tokens: string[];
    if (inner.includes('/')) {
      const slashParts = inner.split('/');
      if (slashParts.length !== 2) {
        throw new Error(`Invalid hsl/hsla syntax with slash: ${str}`);
      }
      const hslParts = slashParts[0]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      tokens = [...hslParts, slashParts[1].trim()];
    } else if (inner.includes(',')) {
      tokens = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      tokens = inner.split(/\s+/).filter(Boolean);
    }

    if (tokens.length !== 3 && tokens.length !== 4) {
      throw new Error(`Invalid hsl/hsla format: expected 3 or 4 components, got ${tokens.length}`);
    }

    let hToken = tokens[0];
    if (hToken.endsWith('deg')) {
      hToken = hToken.slice(0, -3);
    }
    const h = Number(hToken);
    if (Number.isNaN(h) || h < 0 || h > 360) {
      throw new Error(`Hue must be between 0 and 360: ${tokens[0]}`);
    }

    let sToken = tokens[1];
    if (sToken.endsWith('%')) {
      sToken = sToken.slice(0, -1);
    }
    const s = Number(sToken);
    if (Number.isNaN(s) || s < 0 || s > 100) {
      throw new Error(`Saturation must be between 0 and 100: ${tokens[1]}`);
    }

    let lToken = tokens[2];
    if (lToken.endsWith('%')) {
      lToken = lToken.slice(0, -1);
    }
    const l = Number(lToken);
    if (Number.isNaN(l) || l < 0 || l > 100) {
      throw new Error(`Lightness must be between 0 and 100: ${tokens[2]}`);
    }

    let a = 1;
    if (tokens.length === 4) {
      const aToken = tokens[3];
      if (aToken.endsWith('%')) {
        const aNum = Number(aToken.slice(0, -1));
        if (Number.isNaN(aNum) || aNum < 0 || aNum > 100) {
          throw new Error(`Alpha percentage must be between 0% and 100%: ${aToken}`);
        }
        a = Math.round((aNum / 100) * 100) / 100;
      } else {
        const aNum = Number(aToken);
        if (Number.isNaN(aNum) || aNum < 0 || aNum > 1) {
          throw new Error(`Alpha must be between 0 and 1: ${aToken}`);
        }
        a = Math.round(aNum * 100) / 100;
      }
    }

    return hslToRgb(h, s, l, a);
  }

  throw new Error(
    `Unsupported color format: "${str}". Expected #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), or hsla()`
  );
}

function hslToRgb(h: number, s: number, l: number, a: number): RgbColor {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r: number;
  let g: number;
  let b: number;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a,
  };
}

function rgbToHsl(r: number, g: number, b: number, a: number): HslColor {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rNorm) {
      h = ((gNorm - bNorm) / d) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / d + 2;
    } else {
      h = (rNorm - gNorm) / d + 4;
    }
    h = h * 60;
    if (h < 0) {
      h += 360;
    }
  }
  h = Math.round(h * 10) / 10;
  if (h === 360) {
    h = 0;
  }
  return {
    h,
    s: Math.round(s * 100 * 10) / 10,
    l: Math.round(l * 100 * 10) / 10,
    a,
  };
}

function rgbToHex(r: number, g: number, b: number, a: number): string {
  const rHex = Math.min(255, Math.max(0, Math.round(r)))
    .toString(16)
    .padStart(2, '0');
  const gHex = Math.min(255, Math.max(0, Math.round(g)))
    .toString(16)
    .padStart(2, '0');
  const bHex = Math.min(255, Math.max(0, Math.round(b)))
    .toString(16)
    .padStart(2, '0');
  if (a < 1) {
    const aHex = Math.min(255, Math.max(0, Math.round(a * 255)))
      .toString(16)
      .padStart(2, '0');
    return `#${rHex}${gHex}${bHex}${aHex}`;
  }
  return `#${rHex}${gHex}${bHex}`;
}

function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const rLin = sRgbToLinear(r);
  const gLin = sRgbToLinear(g);
  const bLin = sRgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function calculateContrast(c1: RgbColor, c2: RgbColor) {
  let r1 = c1.r;
  let g1 = c1.g;
  let b1 = c1.b;
  const r2 = c2.r;
  const g2 = c2.g;
  const b2 = c2.b;

  if (c1.a < 1) {
    r1 = Math.round(c1.r * c1.a + c2.r * (1 - c1.a));
    g1 = Math.round(c1.g * c1.a + c2.g * (1 - c1.a));
    b1 = Math.round(c1.b * c1.a + c2.b * (1 - c1.a));
  }

  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  const ratio = Math.round(rawRatio * 100) / 100;

  const normalAA = ratio >= 4.5;
  const normalAAA = ratio >= 7.0;
  const largeAA = ratio >= 3.0;
  const largeAAA = ratio >= 4.5;

  return {
    ratio,
    contrastRatio: ratio,
    normalText: {
      aa: normalAA,
      aaa: normalAAA,
    },
    largeText: {
      aa: largeAA,
      aaa: largeAAA,
    },
    aa: {
      normal: normalAA,
      large: largeAA,
      normalText: normalAA,
      largeText: largeAA,
    },
    aaa: {
      normal: normalAAA,
      large: largeAAA,
      normalText: normalAAA,
      largeText: largeAAA,
    },
  };
}

export function color(): number {
  try {
    const inputStr = Host.inputString();
    let input: ColorInput;
    try {
      input = JSON.parse(inputStr);
    } catch {
      throw new Error('Invalid JSON input');
    }

    if (!input || typeof input !== 'object') {
      throw new Error('Input must be a JSON object');
    }

    let operation = input.operation;
    if (!operation) {
      if (input.color2 !== undefined || input.background !== undefined) {
        operation = 'contrast';
      } else {
        operation = 'convert';
      }
    }

    if (operation === 'convert') {
      const colorStr = input.color ?? input.color1 ?? input.foreground ?? input.input ?? input.text;
      if (typeof colorStr !== 'string') {
        throw new Error('color must be a string for convert operation');
      }
      const parsed = parseColor(colorStr);
      const hex = rgbToHex(parsed.r, parsed.g, parsed.b, parsed.a);
      const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b, parsed.a);

      const output: ColorOutput = {
        hex,
        rgb: {
          r: parsed.r,
          g: parsed.g,
          b: parsed.b,
          a: parsed.a,
        },
        hsl,
      };
      Host.outputString(JSON.stringify(output));
      return 0;
    }

    if (operation === 'contrast') {
      const c1Str = input.color ?? input.color1 ?? input.foreground;
      const c2Str = input.color2 ?? input.background;
      if (typeof c1Str !== 'string' || typeof c2Str !== 'string') {
        throw new Error('contrast operation requires two colors (color and color2)');
      }
      const c1 = parseColor(c1Str);
      const c2 = parseColor(c2Str);
      const contrastResult = calculateContrast(c1, c2);

      const output: ColorOutput = {
        ...contrastResult,
      };
      Host.outputString(JSON.stringify(output));
      return 0;
    }

    throw new Error(`Unknown operation: ${operation}. Expected "convert" or "contrast"`);
  } catch (error) {
    const output: ColorOutput = {
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
