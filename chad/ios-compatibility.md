# iOS Compatibility Analysis

Running just-bash on iOS via WKWebView or JavaScriptCore.

## Will Work

- **Parser** (`src/parser/`) - Pure JS, no Node deps
- **AST** (`src/ast/`) - Type definitions only
- **Interpreter** (`src/interpreter/`) - Standard JS APIs only (except `process.pid`)
- **VirtualFs** (`src/fs.ts`) - Uses `Uint8Array`, `TextEncoder`, `TextDecoder` (web standard)
- **Commands** (`src/commands/`) - Most are pure JS (except base64, curl noted below)
- **AWK/SED** - Pure JS implementations
- **Glob matching** - Uses minimatch (pure JS)

## Needs Adaptation

| File | Issue | Fix |
|------|-------|-----|
| `src/interpreter/expansion/variable.ts:77` | `process.pid` for `$$` | Inject via config or return fixed value (e.g., 1) |
| `src/commands/base64/base64.ts:49,52` | `Buffer.from(..., 'base64')` | Use `btoa()`/`atob()` with UTF-8 handling |
| `src/commands/curl/curl.ts:78` | `Buffer.from()` for Basic auth | Use `btoa()` |

## Won't Work (Exclude from bundle)

- `src/overlay-fs/` - Uses `node:fs`, `node:path`
- `src/cli/` - Node-specific (readline, process.argv)
- `src/sandbox/` - Uses Node child_process concepts

## Needs Verification

| Item | Concern |
|------|---------|
| `minimatch` | Likely fine (pure JS glob) - verify no Node fs calls |
| `sprintf-js` | Likely fine - verify |
| `diff` | Likely fine - verify |
| `turndown` | DOM-dependent (HTML→markdown); works in WKWebView, not pure JSC |
| `TextEncoder`/`TextDecoder` | Available in WKWebView; may need polyfill in pure JSC |
| Bundle size | Current build targets Node; browser build may differ |

## Gotchas

1. **Memory limits** - iOS has tighter constraints; VirtualFs holds everything in RAM
2. **Async iteration** - Interpreter uses async generators; verify iOS JS engine support
3. **fetch availability** - Network commands need fetch; available in iOS but may have CORS differences
4. **No real filesystem** - OverlayFs unavailable; can only use VirtualFs
5. **turndown for curl** - `curl` uses turndown to convert HTML responses; needs DOM context or exclude feature
6. **Execution limits** - May need tighter defaults for mobile

## Implementation Paths

### Path A: WKWebView

Full browser environment with DOM.

**Pros:**
- `turndown` works (has DOM)
- `fetch` available with full browser networking
- `TextEncoder`/`TextDecoder` guaranteed
- Easier debugging (Safari Web Inspector)

**Cons:**
- Heavier runtime
- WebView security restrictions
- Communication overhead (JS ↔ Swift via message handlers)

**Steps:**
1. Create browser-targeted esbuild config (`platform: 'browser'`)
2. Replace `Buffer.from()` calls with `btoa()`/`atob()` wrappers
3. Make `process.pid` configurable or return constant
4. Exclude: overlay-fs, cli, sandbox from bundle
5. Expose API via `window.JustBash` or ES module
6. Test in Safari/iOS simulator

### Path B: JavaScriptCore (No WebView)

Pure JS engine, no DOM.

**Pros:**
- Lighter weight
- Direct Swift ↔ JS bridging
- No WebView security overhead
- Better for background execution

**Cons:**
- No DOM → `turndown` won't work → curl HTML parsing broken
- May need `TextEncoder`/`TextDecoder` polyfills
- `fetch` must be injected from Swift side
- Harder to debug

**Steps:**
1. Same as Path A steps 1-4
2. Remove or stub `turndown` dependency (curl returns raw HTML)
3. Verify/add `TextEncoder`/`TextDecoder` polyfills
4. Create Swift bridge for `fetch` if network commands needed
5. Inject via `JSContext.evaluateScript()`
6. Test with Xcode JSC debugger

### Recommended Approach

Start with **Path A (WKWebView)** for faster iteration:
- Fewer unknowns
- Easier to test and debug
- Can optimize to Path B later if performance requires

## API Surface for iOS

```typescript
import { Bash, VirtualFs } from 'just-bash';

const fs = new VirtualFs({
  '/home/user/data.txt': 'file contents',
  '/home/user/script.sh': '#!/bin/bash\necho hello',
});

const bash = new Bash({ fs });

const result = await bash.exec('cat /home/user/data.txt');
// { stdout: 'file contents\n', stderr: '', exitCode: 0 }
```

## Open Questions

- What's the target iOS version? (affects JS engine features)
- Need network commands (curl, wget) or can exclude?
- Acceptable bundle size?
- Background execution required? (favors Path B)
