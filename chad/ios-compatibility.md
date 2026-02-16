# iOS Compatibility Analysis

Running just-bash on iOS via WKWebView or JavaScriptCore.

## Existing Browser Support

A browser bundle already exists (`8a35592`):
- Entry point: `src/browser.ts` → `dist/bundle/browser.js`
- Import via: `just-bash/browser`
- Build: `esbuild --platform=browser --external:node:*`
- Exports `InMemoryFs` instead of node-dependent filesystems

## Lazy File Loading (Built-in)

As of `c7a4da4` (#115), `InMemoryFs` supports lazy file providers - functions that load content on first access:

```typescript
import { Bash, InMemoryFs } from 'just-bash/browser';

const fs = new InMemoryFs({
  // Immediate content
  '/config.txt': 'small config',

  // Lazy - only loaded when file is read
  '/data/large.json': () => swift.readFileFromBundle('large.json'),
  '/data/image.png': async () => await swift.fetchAsset('image.png'),
});

const bash = new Bash({ fs });
await bash.exec('cat /data/large.json'); // NOW it loads from Swift
```

**Benefits for iOS:**
- Zero memory cost at init for unread files
- Fast startup with many files
- Natural bridge point to Swift for on-demand loading
- Async functions supported for network/disk fetches

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
| `src/interpreter/expansion/variable.ts:127` | `process.pid` for `$$` | Inject via config or return fixed value (e.g., 1) |
| `src/commands/curl/curl.ts:82` | `Buffer.from()` for Basic auth | Use `btoa()` |

**Already fixed:**
- `src/commands/base64/base64.ts` - now uses `atob()`/`btoa()`

## Won't Work (Exclude from bundle)

- `src/overlay-fs/` - Uses `node:fs`, `node:path`
- `src/cli/` - Node-specific (readline, process.argv)
- `src/sandbox/` - Uses Node child_process concepts
- `gzip`, `gunzip`, `zcat` - Use `node:zlib` (noted in browser.ts)

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

1. **Async iteration** - Interpreter uses async generators; verify iOS JS engine support
2. **fetch availability** - Network commands need fetch; available in iOS but may have CORS differences
3. **No real filesystem** - OverlayFs unavailable; can only use InMemoryFs
4. **turndown for curl** - `curl` uses turndown to convert HTML responses; needs DOM context or exclude feature
5. **Execution limits** - May need tighter defaults for mobile

Note: Memory concerns addressed by lazy file loading (see above).

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
1. Use existing browser bundle (`just-bash/browser`)
2. Fix `curl` auth to use `btoa()` instead of `Buffer.from()`
3. Fix `process.pid` - make configurable or return constant
4. Test in Safari/iOS simulator

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
1. Same as Path A steps 1-3
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
import { Bash, InMemoryFs } from 'just-bash/browser';

const fs = new InMemoryFs({
  // Immediate small files
  '/home/user/script.sh': '#!/bin/bash\necho hello',

  // Lazy load from Swift
  '/home/user/data.txt': () => swift.readFile('data.txt'),
  '/home/user/large.json': async () => await swift.fetchAsset('large.json'),
});

const bash = new Bash({ fs });

const result = await bash.exec('cat /home/user/data.txt');
// { stdout: 'file contents\n', stderr: '', exitCode: 0 }
```

## Relevant Upstream PRs

Upstream: `vercel-labs/just-bash`

| PR | Title | iOS Relevance |
|----|-------|---------------|
| [#66](https://github.com/vercel-labs/just-bash/pull/66) | Make Bash serializable | Persist state between app launches |
| [#42](https://github.com/vercel-labs/just-bash/pull/42) | Custom backing store for in-memory-fs | Could allow iOS-native storage backend |

Note: #67 (LazyFs) largely obsoleted by #115's lazy file providers which is now merged.

## Open Questions

- What's the target iOS version? (affects JS engine features)
- Need network commands (curl, wget) or can exclude?
- Acceptable bundle size?
- Background execution required? (favors Path B)
