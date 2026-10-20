import { header, section } from '../_shared/setup.js';
import { Cogitator } from '@cogitator-ai/core';
import { loadConfig } from '@cogitator-ai/config';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

header('Config: Loading YAML and Environment Overrides');

const configPath = join(import.meta.dirname, 'cogitator.yml');

// Ensure cogitator.yml exists if not present
if (!existsSync(configPath)) {
  writeFileSync(
    configPath,
    'llm:\n  defaultProvider: ollama\n  defaultModel: ollama/llama3.2\n  providers:\n    ollama:\n      baseUrl: http://localhost:11434\n'
  );
}

section('1. Load configuration from YAML file');

// Ensure clean environment for the initial load
delete process.env.COGITATOR_LLM_DEFAULT_MODEL;

const fileConfig = loadConfig({ configPath });
console.log('Loaded from cogitator.yml:');
console.log(`  Provider: ${fileConfig.llm?.defaultProvider}`);
console.log(`  Model:    ${fileConfig.llm?.defaultModel}`);

section('2. Override file value via environment variable');

// Environment variables with COGITATOR_* take precedence over YAML values
process.env.COGITATOR_LLM_DEFAULT_MODEL = 'ollama/qwen3:8b';

const overriddenConfig = loadConfig({ configPath });
console.log('Loaded with COGITATOR_LLM_DEFAULT_MODEL in environment:');
console.log(`  Provider: ${overriddenConfig.llm?.defaultProvider}`);
console.log(
  `  Model:    ${overriddenConfig.llm?.defaultModel} (overridden from ${fileConfig.llm?.defaultModel})`
);

section('3. Build Cogitator instance from configuration');

// Initialize Cogitator runtime with the resolved configuration
const cog = new Cogitator(overriddenConfig);
console.log(`Cogitator runtime created: ${cog instanceof Cogitator}`);
console.log(`Active default model:      ${overriddenConfig.llm?.defaultModel}`);

// Clean up environment
delete process.env.COGITATOR_LLM_DEFAULT_MODEL;

console.log('\nDone.');
