import { Command, CommandContext, ExecResult } from '../../types.js';
import { hasHelpFlag, showHelp } from '../help.js';

const envHelp = {
  name: 'env',
  summary: 'print environment variables',
  usage: 'env [OPTION]... [NAME=VALUE]...',
  options: [
    '    --help       display this help and exit',
  ],
};

export const envCommand: Command = {
  name: 'env',

  async execute(args: string[], ctx: CommandContext): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(envHelp);
    }

    // Simple env: just print all environment variables
    const lines: string[] = [];
    for (const [key, value] of Object.entries(ctx.env)) {
      lines.push(`${key}=${value}`);
    }

    return {
      stdout: lines.join('\n') + (lines.length > 0 ? '\n' : ''),
      stderr: '',
      exitCode: 0,
    };
  },
};

const printenvHelp = {
  name: 'printenv',
  summary: 'print all or part of environment',
  usage: 'printenv [OPTION]... [VARIABLE]...',
  options: [
    '    --help       display this help and exit',
  ],
};

export const printenvCommand: Command = {
  name: 'printenv',

  async execute(args: string[], ctx: CommandContext): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(printenvHelp);
    }

    const vars = args.filter(arg => !arg.startsWith('-'));

    if (vars.length === 0) {
      // Print all
      const lines: string[] = [];
      for (const [key, value] of Object.entries(ctx.env)) {
        lines.push(`${key}=${value}`);
      }
      return {
        stdout: lines.join('\n') + (lines.length > 0 ? '\n' : ''),
        stderr: '',
        exitCode: 0,
      };
    }

    // Print specific variables
    const lines: string[] = [];
    let exitCode = 0;
    for (const varName of vars) {
      if (varName in ctx.env) {
        lines.push(ctx.env[varName]);
      } else {
        exitCode = 1;
      }
    }

    return {
      stdout: lines.join('\n') + (lines.length > 0 ? '\n' : ''),
      stderr: '',
      exitCode,
    };
  },
};
