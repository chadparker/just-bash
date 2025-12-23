import { describe, it, expect } from 'vitest';
import { BashEnv } from '../../BashEnv.js';

describe('xargs command', () => {
  it('should build echo command by default', async () => {
    const env = new BashEnv();
    const result = await env.exec('echo "a b c" | xargs');
    expect(result.stdout).toBe('echo a b c\n');
    expect(result.exitCode).toBe(0);
  });

  it('should use specified command', async () => {
    const env = new BashEnv();
    const result = await env.exec('echo "file1 file2" | xargs ls');
    expect(result.stdout).toBe('ls file1 file2\n');
  });

  it('should batch with -n option', async () => {
    const env = new BashEnv();
    const result = await env.exec('echo "a b c d" | xargs -n 2');
    expect(result.stdout).toBe('echo a b\necho c d\n');
  });

  it('should replace with -I option', async () => {
    const env = new BashEnv();
    const result = await env.exec('echo "a\nb\nc" | xargs -I {} echo file-{}');
    expect(result.stdout).toBe('echo file-a\necho file-b\necho file-c\n');
  });

  it('should handle empty input', async () => {
    const env = new BashEnv();
    const result = await env.exec('echo "" | xargs');
    expect(result.stdout).toBe('');
    expect(result.exitCode).toBe(0);
  });

  it('should show help with --help', async () => {
    const env = new BashEnv();
    const result = await env.exec('xargs --help');
    expect(result.stdout).toContain('xargs');
    expect(result.stdout).toContain('build and execute');
    expect(result.exitCode).toBe(0);
  });
});
