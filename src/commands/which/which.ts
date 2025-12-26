import type { Command, CommandContext, ExecResult } from "../../types.js";
import { hasHelpFlag, showHelp } from "../help.js";

const whichHelp = {
  name: "which",
  summary: "locate a command",
  usage: "which [-as] program ...",
  options: [
    "-a         List all instances of executables found",
    "-s         No output, just return 0 if found, 1 if not",
    "--help     display this help and exit",
  ],
};

export const whichCommand: Command = {
  name: "which",

  async execute(args: string[], ctx: CommandContext): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(whichHelp);
    }

    let showAll = false;
    let silent = false;
    const names: string[] = [];

    for (const arg of args) {
      if (arg === "-a") {
        showAll = true;
      } else if (arg === "-s") {
        silent = true;
      } else if (arg === "-as" || arg === "-sa") {
        showAll = true;
        silent = true;
      } else if (arg.startsWith("-") && arg !== "-") {
      } else {
        names.push(arg);
      }
    }

    if (names.length === 0) {
      return { stdout: "", stderr: "", exitCode: 1 };
    }

    const pathEnv = ctx.env.PATH || "/bin:/usr/bin";
    const pathDirs = pathEnv.split(":");

    let stdout = "";
    let allFound = true;

    for (const name of names) {
      let found = false;

      for (const dir of pathDirs) {
        if (!dir) continue;
        const fullPath = `${dir}/${name}`;
        if (await ctx.fs.exists(fullPath)) {
          found = true;
          if (!silent) {
            stdout += `${fullPath}\n`;
          }
          if (!showAll) {
            break;
          }
        }
      }

      if (!found) {
        allFound = false;
      }
    }

    return {
      stdout,
      stderr: "",
      exitCode: allFound ? 0 : 1,
    };
  },
};
