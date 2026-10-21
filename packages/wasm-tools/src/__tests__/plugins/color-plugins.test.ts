import { describe, it, expect } from 'vitest';
import { runPlugin } from '../helpers/run-plugin';

interface ConvertOutput {
  hex?: string;
  rgb?: { r: number; g: number; b: number; a: number };
  hsl?: { h: number; s: number; l: number; a: number };
  error?: string;
}

interface ContrastOutput {
  ratio?: number;
  contrastRatio?: number;
  normalText?: { aa: boolean; aaa: boolean };
  largeText?: { aa: boolean; aaa: boolean };
  aa?: { normal: boolean; large: boolean };
  aaa?: { normal: boolean; large: boolean };
  error?: string;
}

describe('color plugin: convert', () => {
  it('parses #rgb format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: '#0f0',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#00ff00');
    expect(res.output.rgb).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(res.output.hsl).toEqual({ h: 120, s: 100, l: 50, a: 1 });
  });

  it('parses #rrggbb format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: '#0000ff',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#0000ff');
    expect(res.output.rgb).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(res.output.hsl).toEqual({ h: 240, s: 100, l: 50, a: 1 });
  });

  it('parses #rrggbbaa format with alpha', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: '#ff000080',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#ff000080');
    expect(res.output.rgb).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(res.output.hsl).toEqual({ h: 0, s: 100, l: 50, a: 0.5 });
  });

  it('parses rgb() format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'rgb(255, 255, 0)',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#ffff00');
    expect(res.output.rgb).toEqual({ r: 255, g: 255, b: 0, a: 1 });
    expect(res.output.hsl).toEqual({ h: 60, s: 100, l: 50, a: 1 });
  });

  it('parses rgba() format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'rgba(255, 0, 255, 0.5)',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#ff00ff80');
    expect(res.output.rgb).toEqual({ r: 255, g: 0, b: 255, a: 0.5 });
    expect(res.output.hsl).toEqual({ h: 300, s: 100, l: 50, a: 0.5 });
  });

  it('parses hsl() format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'hsl(180, 100%, 50%)',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#00ffff');
    expect(res.output.rgb).toEqual({ r: 0, g: 255, b: 255, a: 1 });
    expect(res.output.hsl).toEqual({ h: 180, s: 100, l: 50, a: 1 });
  });

  it('parses hsla() format', () => {
    const res = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'hsla(120, 100%, 50%, 0.25)',
    });
    expect(res.code).toBe(0);
    expect(res.output.hex).toBe('#00ff0040');
    expect(res.output.rgb).toEqual({ r: 0, g: 255, b: 0, a: 0.25 });
    expect(res.output.hsl).toEqual({ h: 120, s: 100, l: 50, a: 0.25 });
  });

  it('parses modern space-separated and slash syntax', () => {
    const rgbRes = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'rgb(255 0 0 / 0.5)',
    });
    expect(rgbRes.code).toBe(0);
    expect(rgbRes.output.hex).toBe('#ff000080');
    expect(rgbRes.output.rgb).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });

    const hslRes = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: 'hsl(240deg 100% 50% / 50%)',
    });
    expect(hslRes.code).toBe(0);
    expect(hslRes.output.hex).toBe('#0000ff80');
    expect(hslRes.output.rgb).toEqual({ r: 0, g: 0, b: 255, a: 0.5 });
  });

  it('preserves alpha across conversion round-trips', () => {
    const original = 'rgba(255, 0, 0, 0.5)';
    const first = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: original,
    });
    expect(first.code).toBe(0);
    expect(first.output.hex).toBe('#ff000080');

    // Round-trip from generated hex
    const fromHex = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: first.output.hex,
    });
    expect(fromHex.code).toBe(0);
    expect(fromHex.output.hex).toBe(first.output.hex);
    expect(fromHex.output.rgb).toEqual(first.output.rgb);
    expect(fromHex.output.hsl).toEqual(first.output.hsl);

    // Round-trip from generated hsl
    const hslString = `hsla(${first.output.hsl!.h}, ${first.output.hsl!.s}%, ${first.output.hsl!.l}%, ${first.output.hsl!.a})`;
    const fromHsl = runPlugin<ConvertOutput>('color', 'color', {
      operation: 'convert',
      color: hslString,
    });
    expect(fromHsl.code).toBe(0);
    expect(fromHsl.output.hex).toBe(first.output.hex);
    expect(fromHsl.output.rgb).toEqual(first.output.rgb);
  });

  it('performs conversion round-trips for various standard colors', () => {
    const testColors = [
      '#ff0000', // red
      '#00ff00', // green
      '#0000ff', // blue
      '#ffffff', // white
      '#000000', // black
      '#ffff00', // yellow
      '#00ffff', // cyan
      '#ff00ff', // magenta
      '#123456', // custom navy
      '#abcdef', // custom pastel blue
    ];

    for (const color of testColors) {
      const conv = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color,
      });
      expect(conv.code).toBe(0);
      expect(conv.output.hex).toBe(color);

      // Round-trip through rgb()
      const rgb = conv.output.rgb!;
      const fromRgb = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      });
      expect(fromRgb.code).toBe(0);
      expect(fromRgb.output.hex).toBe(color);

      // Round-trip through hsl()
      const hsl = conv.output.hsl!;
      const fromHsl = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      });
      expect(fromHsl.code).toBe(0);
      expect(fromHsl.output.hex).toBe(color);
    }
  });

  describe('invalid inputs and boundary cases', () => {
    it('returns structured error for invalid hex characters including #ggg', () => {
      const res = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: '#ggg',
      });
      expect(res.code).toBe(1);
      expect(res.output.error).toMatch(/hex/i);
    });

    it('returns structured error for out-of-range RGB including rgb(300, 0, 0)', () => {
      const res = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'rgb(300, 0, 0)',
      });
      expect(res.code).toBe(1);
      expect(res.output.error).toMatch(/between 0 and 255/i);
    });

    it('returns structured error for negative RGB', () => {
      const res = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'rgb(-1, 0, 0)',
      });
      expect(res.code).toBe(1);
      expect(res.output.error).toMatch(/between 0 and 255/i);
    });

    it('returns structured error for out-of-range alpha', () => {
      const res1 = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'rgba(0, 0, 0, 1.5)',
      });
      expect(res1.code).toBe(1);
      expect(res1.output.error).toMatch(/alpha/i);

      const res2 = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'rgba(0, 0, 0, -0.2)',
      });
      expect(res2.code).toBe(1);
      expect(res2.output.error).toMatch(/alpha/i);
    });

    it('returns structured error for out-of-range HSL values', () => {
      const resHue = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'hsl(400, 100%, 50%)',
      });
      expect(resHue.code).toBe(1);
      expect(resHue.output.error).toMatch(/hue/i);

      const resSat = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'hsl(0, 150%, 50%)',
      });
      expect(resSat.code).toBe(1);
      expect(resSat.output.error).toMatch(/saturation/i);

      const resLight = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'hsl(0, 50%, -10%)',
      });
      expect(resLight.code).toBe(1);
      expect(resLight.output.error).toMatch(/lightness/i);
    });

    it('returns structured error for malformed hex length', () => {
      for (const badHex of ['#1', '#12', '#12345', '#1234567', '#123456789']) {
        const res = runPlugin<ConvertOutput>('color', 'color', {
          operation: 'convert',
          color: badHex,
        });
        expect(res.code).toBe(1);
        expect(res.output.error).toMatch(/hex/i);
      }
    });

    it('returns structured error for unsupported color formats', () => {
      const res = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: 'not-a-color',
      });
      expect(res.code).toBe(1);
      expect(res.output.error).toMatch(/unsupported/i);
    });

    it('returns structured error for empty color input', () => {
      const res = runPlugin<ConvertOutput>('color', 'color', {
        operation: 'convert',
        color: '   ',
      });
      expect(res.code).toBe(1);
      expect(res.output.error).toMatch(/empty/i);
    });
  });
});

describe('color plugin: contrast', () => {
  it('calculates known black/white contrast ratio = 21:1', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#000000',
      color2: '#ffffff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(21);
    expect(res.output.normalText).toEqual({ aa: true, aaa: true });
    expect(res.output.largeText).toEqual({ aa: true, aaa: true });
    expect(res.output.aa).toMatchObject({ normal: true, large: true });
    expect(res.output.aaa).toMatchObject({ normal: true, large: true });
  });

  it('is symmetric regardless of color order', () => {
    const res1 = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#000000',
      color2: '#ffffff',
    });
    const res2 = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#ffffff',
      color2: '#000000',
    });
    expect(res1.output.ratio).toBe(res2.output.ratio);
    expect(res1.output.normalText).toEqual(res2.output.normalText);
    expect(res1.output.largeText).toEqual(res2.output.largeText);
  });

  it('calculates same-color contrast ratio = 1:1', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#ffffff',
      color2: '#ffffff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(1);
    expect(res.output.normalText).toEqual({ aa: false, aaa: false });
    expect(res.output.largeText).toEqual({ aa: false, aaa: false });
  });

  it('tests WCAG AA threshold with #767676 on white (ratio ~ 4.54:1)', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#767676',
      color2: '#ffffff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(4.54);
    // 4.54 >= 4.5 (AA normal: pass), < 7.0 (AAA normal: fail)
    expect(res.output.normalText).toEqual({ aa: true, aaa: false });
    // 4.54 >= 3.0 (AA large: pass), >= 4.5 (AAA large: pass)
    expect(res.output.largeText).toEqual({ aa: true, aaa: true });
  });

  it('tests WCAG AAA threshold with #595959 on white (ratio ~ 7.00:1)', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#595959',
      color2: '#ffffff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(7);
    expect(res.output.normalText).toEqual({ aa: true, aaa: true });
    expect(res.output.largeText).toEqual({ aa: true, aaa: true });
  });

  it('tests large-text AA boundary with pure red on white (ratio ~ 4.00:1)', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#ff0000',
      color2: '#ffffff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(4);
    // 4.00 < 4.5 (normal AA fail, normal AAA fail)
    expect(res.output.normalText).toEqual({ aa: false, aaa: false });
    // 4.00 >= 3.0 (large AA pass), < 4.5 (large AAA fail)
    expect(res.output.largeText).toEqual({ aa: true, aaa: false });
  });

  it('accepts contrast between different color formats', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: 'rgb(0, 0, 0)',
      color2: 'hsl(0, 0%, 100%)',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(21);
  });

  it('supports foreground and background aliases', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      foreground: '#000',
      background: '#fff',
    });
    expect(res.code).toBe(0);
    expect(res.output.ratio).toBe(21);
  });

  it('returns error if either color is invalid', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#ggg',
      color2: '#ffffff',
    });
    expect(res.code).toBe(1);
    expect(res.output.error).toMatch(/hex/i);
  });

  it('returns error if second color is missing', () => {
    const res = runPlugin<ContrastOutput>('color', 'color', {
      operation: 'contrast',
      color: '#000000',
    });
    expect(res.code).toBe(1);
    expect(res.output.error).toMatch(/two colors/i);
  });
});
