import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { checkDocker, findDockerCompose, composePs } = vi.hoisted(() => ({
  checkDocker: vi.fn(),
  findDockerCompose: vi.fn(),
  composePs: vi.fn(),
}));

vi.mock('../utils/docker.js', () => ({
  checkDocker,
  findDockerCompose,
  composePs,
}));

import { modelsCommand } from '../commands/models.js';
import { collectStatus } from '../commands/status.js';

function headersOf(fetcher: ReturnType<typeof vi.fn>, index = 0): Record<string, string> {
  const init = fetcher.mock.calls[index]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

describe('Ollama command authorization', () => {
  let dir: string;
  let cwd: string;
  const saved = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cli-ollama-auth-'));
    cwd = process.cwd();
    process.chdir(dir);
    for (const key of Object.keys(process.env)) {
      if (/^(COGITATOR_|OLLAMA_)/.test(key)) delete process.env[key];
    }
    writeFileSync(
      join(dir, 'cogitator.yml'),
      [
        'llm:',
        '  defaultModel: ollama/qwen3:8b',
        '  providers:',
        '    ollama:',
        '      baseUrl: http://config.example',
        '      apiKey: config-key',
        '      headers:',
        '        X-Gateway-Key: secret',
        '        authorization: Bearer custom',
        '',
      ].join('\n')
    );
    checkDocker.mockReturnValue(false);
    findDockerCompose.mockReturnValue(null);
    composePs.mockReturnValue([]);
  });

  afterEach(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
    process.env = { ...saved };
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('models sends config credentials and lets the config apiKey replace custom authorization', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({ models: [{ name: 'qwen3:8b', size: 1, modified_at: '' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await modelsCommand.parseAsync(['--json'], { from: 'user' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://config.example/api/tags',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(headersOf(fetchMock)).toEqual({
      'X-Gateway-Key': 'secret',
      Authorization: 'Bearer config-key',
    });
  });

  it('status sends config credentials and lets the config apiKey replace custom authorization', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({ models: [{ name: 'qwen3:8b', size: 1, modified_at: '' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await collectStatus();

    expect(report.ollama).toEqual({ url: 'http://config.example', running: true });
    expect(headersOf(fetchMock)).toEqual({
      'X-Gateway-Key': 'secret',
      Authorization: 'Bearer config-key',
    });
  });

  it('models --url uses the override without sending config credentials to another server', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({ models: [{ name: 'qwen3:8b', size: 1, modified_at: '' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    await modelsCommand.parseAsync(['--url', 'http://other.example', '--json'], { from: 'user' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://other.example/api/tags');
    expect(headersOf(fetchMock)).toEqual({});
  });
});
