import { Command, CommandContext, ExecResult } from '../../types.js';
import { hasHelpFlag, showHelp } from '../help.js';

const xargsHelp = {
  name: 'xargs',
  summary: 'build and execute command lines from standard input',
  usage: 'xargs [OPTION]... [COMMAND [INITIAL-ARGS]]',
  options: [
    '-I REPLACE   replace occurrences of REPLACE with input',
    '-n NUM       use at most NUM arguments per command line',
    '-0, --null   items are separated by null, not whitespace',
    '    --help   display this help and exit',
  ],
};

export const xargsCommand: Command = {
  name: 'xargs',

  async execute(args: string[], ctx: CommandContext): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(xargsHelp);
    }

    let replaceStr: string | null = null;
    let maxArgs: number | null = null;
    let nullSeparator = false;
    let commandStart = 0;

    // Parse xargs options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-I' && i + 1 < args.length) {
        replaceStr = args[++i];
        commandStart = i + 1;
      } else if (arg === '-n' && i + 1 < args.length) {
        maxArgs = parseInt(args[++i], 10);
        commandStart = i + 1;
      } else if (arg === '-0' || arg === '--null') {
        nullSeparator = true;
        commandStart = i + 1;
      } else if (!arg.startsWith('-')) {
        commandStart = i;
        break;
      }
    }

    // Get command and initial args
    const command = args.slice(commandStart);
    if (command.length === 0) {
      command.push('echo');
    }

    // Parse input
    const separator = nullSeparator ? '\0' : /\s+/;
    const items = ctx.stdin
      .split(separator)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (items.length === 0) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    // This is a simplified xargs - in real usage it would execute commands
    // For the virtual environment, we just build the command lines
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    if (replaceStr !== null) {
      // -I mode: run command once per item, replacing replaceStr in each argument
      for (const item of items) {
        const cmdLine = command.map(c => c.replaceAll(replaceStr, item)).join(' ');
        stdout += cmdLine + '\n';
      }
    } else if (maxArgs !== null) {
      // -n mode: batch items
      for (let i = 0; i < items.length; i += maxArgs) {
        const batch = items.slice(i, i + maxArgs);
        const cmdLine = [...command, ...batch].join(' ');
        stdout += cmdLine + '\n';
      }
    } else {
      // Default: all items on one line
      const cmdLine = [...command, ...items].join(' ');
      stdout += cmdLine + '\n';
    }

    return { stdout, stderr, exitCode };
  },
};
