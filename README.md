# bash-env

A simulated bash environment with an in-memor (pluggable) virtual filesystem, written in TypeScript.

Designed for agents exploring a filesystem with a "full" but secure bash tool.

## Installation

```bash
pnpm install
```

## Usage

### Programmatic API

```typescript
import { BashEnv } from "./src/BashEnv.js";

const env = new BashEnv({
  files: {
    "/home/user/file.txt": "Hello, world!",
  },
  cwd: "/home/user",
});

const result = await env.exec("cat file.txt | grep Hello");
console.log(result.stdout); // "Hello, world!\n"
```

### Interactive Shell

```bash
pnpm shell
```

## Supported Commands

`basename`, `cat`, `cd`, `cp`, `cut`, `dirname`, `echo`, `env`, `find`, `grep`, `head`, `ls`, `mkdir`, `mv`, `printenv`, `pwd`, `rm`, `sed`, `sort`, `tail`, `tee`, `touch`, `tr`, `true`, `false`, `uniq`, `wc`, `xargs`

All commands support `--help` for usage information.

## Shell Features

- Pipes: `cmd1 | cmd2`
- Redirections: `>`, `>>`, `2>`, `2>&1`, `<`
- Command chaining: `&&`, `||`, `;`
- Variables: `$VAR`, `${VAR}`, `${VAR:-default}`
- Glob patterns: `*`, `?`, `[...]`

## Development

```bash
pnpm test        # Run tests in watch mode
pnpm test:run    # Run tests once
pnpm build       # Build TypeScript
```

## License

ISC
