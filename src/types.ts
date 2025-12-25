import type { IFileSystem } from "./fs-interface.js";
import type { SecureFetch } from "./network/index.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The final environment variables after execution (only set by BashEnv.exec) */
  env?: Record<string, string>;
}

/** Result from BashEnv.exec() - always includes env */
export interface BashExecResult extends ExecResult {
  env: Record<string, string>;
}

/** Options for exec calls within commands */
export interface CommandExecOptions {
  /** Environment variables to merge into the exec state */
  env?: Record<string, string>;
  /** Working directory for the exec */
  cwd?: string;
}

export interface CommandContext {
  fs: IFileSystem;
  cwd: string;
  env: Record<string, string>;
  stdin: string;
  /** Optional exec function for commands that need to run subcommands (like xargs, bash) */
  exec?: (command: string, options?: CommandExecOptions) => Promise<ExecResult>;
  /**
   * Optional secure fetch function for network-enabled commands (like curl).
   * Only available when network access is explicitly configured.
   */
  fetch?: SecureFetch;
  /**
   * Returns names of all registered commands (for help command).
   */
  getRegisteredCommands?: () => string[];
  /**
   * Optional sleep function for the sleep command.
   * If provided, used instead of real setTimeout (useful for testing with mock clocks).
   */
  sleep?: (ms: number) => Promise<void>;
}

export interface Command {
  name: string;
  execute(args: string[], ctx: CommandContext): Promise<ExecResult>;
}

export type CommandRegistry = Map<string, Command>;

// Re-export IFileSystem for convenience
export type { IFileSystem };
