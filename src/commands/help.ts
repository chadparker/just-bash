import { ExecResult } from '../types.js';

export interface HelpInfo {
  name: string;
  summary: string;
  usage: string;
  options?: string[];
}

export function showHelp(info: HelpInfo): ExecResult {
  let output = `${info.name} - ${info.summary}\n\n`;
  output += `Usage: ${info.usage}\n`;
  if (info.options && info.options.length > 0) {
    output += '\nOptions:\n';
    for (const opt of info.options) {
      output += `  ${opt}\n`;
    }
  }
  return { stdout: output, stderr: '', exitCode: 0 };
}

export function hasHelpFlag(args: string[]): boolean {
  return args.includes('--help');
}
