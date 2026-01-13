// Matcher functions for find command

import { matchGlob } from "../../utils/glob.js";
import type { EvalContext, EvalResult, Expression } from "./types.js";

/**
 * Analyze a path pattern to extract optimization hints.
 * For patterns like "*\/pulls\/*.json", we can:
 * 1. Know we need a directory named "pulls" somewhere in the path
 * 2. Know the final file must match "*.json"
 */
export interface PathPatternHints {
  /** Required directory name that must exist in path (e.g., "pulls" for "*\/pulls\/*") */
  requiredDirName: string | null;
  /** File extension filter (e.g., ".json" for "*.json") */
  fileExtension: string | null;
  /** Whether pattern requires file to be in a specific named directory */
  mustBeInNamedDir: boolean;
}

/**
 * Analyze a path pattern to extract optimization hints for directory pruning.
 */
export function analyzePathPattern(pattern: string): PathPatternHints {
  const hints: PathPatternHints = {
    requiredDirName: null,
    fileExtension: null,
    mustBeInNamedDir: false,
  };

  // Split pattern by path separator
  const parts = pattern.split("/").filter((p) => p.length > 0);

  // Look for literal directory names (not wildcards)
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    // Check if this is a literal name (no wildcards)
    if (!part.includes("*") && !part.includes("?") && !part.includes("[")) {
      hints.requiredDirName = part;
      hints.mustBeInNamedDir = true;
      break;
    }
  }

  // Check file extension from last part
  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    // Check for patterns like "*.json" or "*.txt"
    const extMatch = lastPart.match(/^\*(\.[a-zA-Z0-9]+)$/);
    if (extMatch) {
      hints.fileExtension = extMatch[1];
    }
  }

  return hints;
}

/**
 * Check if a directory path could possibly lead to matches for a path pattern.
 * Returns false if we can definitively say no files in this subtree will match.
 */
export function canDirectoryMatchPath(
  dirPath: string,
  dirName: string,
  hints: PathPatternHints,
  hasRequiredDirInPath: boolean,
): { shouldDescend: boolean; hasRequiredDir: boolean } {
  // If no optimization hints available, always descend
  if (!hints.requiredDirName) {
    return { shouldDescend: true, hasRequiredDir: true };
  }

  // Check if this directory IS the required directory
  const isRequiredDir = dirName === hints.requiredDirName;

  // If we've already found the required dir in path, or this is it, descend
  if (hasRequiredDirInPath || isRequiredDir) {
    return { shouldDescend: true, hasRequiredDir: true };
  }

  // Otherwise, we still need to descend to look for the required directory
  return { shouldDescend: true, hasRequiredDir: false };
}

/**
 * Evaluate a find expression and return both match result and prune flag.
 * The prune flag is set when -prune is evaluated and returns true.
 */
export function evaluateExpressionWithPrune(
  expr: Expression,
  ctx: EvalContext,
): EvalResult {
  switch (expr.type) {
    case "name": {
      // Fast path: check extension before full glob match for patterns like "*.json"
      const pattern = expr.pattern;
      const extMatch = pattern.match(/^\*(\.[a-zA-Z0-9]+)$/);
      if (extMatch) {
        const requiredExt = extMatch[1];
        const name = ctx.name;
        // Quick extension check - if extension doesn't match, skip glob
        if (expr.ignoreCase) {
          if (!name.toLowerCase().endsWith(requiredExt.toLowerCase())) {
            return { matches: false, pruned: false, printed: false };
          }
        } else {
          if (!name.endsWith(requiredExt)) {
            return { matches: false, pruned: false, printed: false };
          }
        }
        // For "*.ext" patterns, endsWith is sufficient if it passed
        return { matches: true, pruned: false, printed: false };
      }
      return {
        matches: matchGlob(ctx.name, pattern, expr.ignoreCase),
        pruned: false,
        printed: false,
      };
    }
    case "path": {
      // Fast paths for common patterns
      const pattern = expr.pattern;
      const path = ctx.relativePath;

      // Fast path 1: Check for required directory segments (e.g., "*/pulls/*" requires "/pulls/")
      // Look for literal path segments in the pattern
      const segments = pattern.split("/");
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        // If segment is literal (no wildcards) and not special (. or ..), path must contain this segment
        if (
          seg &&
          seg !== "." &&
          seg !== ".." &&
          !seg.includes("*") &&
          !seg.includes("?") &&
          !seg.includes("[")
        ) {
          const requiredSegment = `/${seg}/`;
          if (expr.ignoreCase) {
            if (!path.toLowerCase().includes(requiredSegment.toLowerCase())) {
              return { matches: false, pruned: false, printed: false };
            }
          } else {
            if (!path.includes(requiredSegment)) {
              return { matches: false, pruned: false, printed: false };
            }
          }
        }
      }

      // Fast path 2: Check extension before full glob match for patterns like "*.json"
      const extMatch = pattern.match(/\*(\.[a-zA-Z0-9]+)$/);
      if (extMatch) {
        const requiredExt = extMatch[1];
        // Quick extension check - if extension doesn't match, skip glob
        if (expr.ignoreCase) {
          if (!path.toLowerCase().endsWith(requiredExt.toLowerCase())) {
            return { matches: false, pruned: false, printed: false };
          }
        } else {
          if (!path.endsWith(requiredExt)) {
            return { matches: false, pruned: false, printed: false };
          }
        }
      }

      return {
        matches: matchGlob(path, pattern, expr.ignoreCase),
        pruned: false,
        printed: false,
      };
    }
    case "regex": {
      try {
        const flags = expr.ignoreCase ? "i" : "";
        const regex = new RegExp(expr.pattern, flags);
        return {
          matches: regex.test(ctx.relativePath),
          pruned: false,
          printed: false,
        };
      } catch {
        return { matches: false, pruned: false, printed: false };
      }
    }
    case "type":
      if (expr.fileType === "f")
        return { matches: ctx.isFile, pruned: false, printed: false };
      if (expr.fileType === "d")
        return { matches: ctx.isDirectory, pruned: false, printed: false };
      return { matches: false, pruned: false, printed: false };
    case "empty":
      return { matches: ctx.isEmpty, pruned: false, printed: false };
    case "mtime": {
      const now = Date.now();
      const fileAgeDays = (now - ctx.mtime) / (1000 * 60 * 60 * 24);
      let matches: boolean;
      if (expr.comparison === "more") {
        matches = fileAgeDays > expr.days;
      } else if (expr.comparison === "less") {
        matches = fileAgeDays < expr.days;
      } else {
        matches = Math.floor(fileAgeDays) === expr.days;
      }
      return { matches, pruned: false, printed: false };
    }
    case "newer": {
      const refMtime = ctx.newerRefTimes.get(expr.refPath);
      if (refMtime === undefined)
        return { matches: false, pruned: false, printed: false };
      return { matches: ctx.mtime > refMtime, pruned: false, printed: false };
    }
    case "size": {
      let targetBytes = expr.value;
      switch (expr.unit) {
        case "c":
          targetBytes = expr.value;
          break;
        case "k":
          targetBytes = expr.value * 1024;
          break;
        case "M":
          targetBytes = expr.value * 1024 * 1024;
          break;
        case "G":
          targetBytes = expr.value * 1024 * 1024 * 1024;
          break;
        case "b":
          targetBytes = expr.value * 512;
          break;
      }
      let matches: boolean;
      if (expr.comparison === "more") {
        matches = ctx.size > targetBytes;
      } else if (expr.comparison === "less") {
        matches = ctx.size < targetBytes;
      } else if (expr.unit === "b") {
        const fileBlocks = Math.ceil(ctx.size / 512);
        matches = fileBlocks === expr.value;
      } else {
        matches = ctx.size === targetBytes;
      }
      return { matches, pruned: false, printed: false };
    }
    case "perm": {
      const fileMode = ctx.mode & 0o777;
      const targetMode = expr.mode & 0o777;
      let matches: boolean;
      if (expr.matchType === "exact") {
        matches = fileMode === targetMode;
      } else if (expr.matchType === "all") {
        matches = (fileMode & targetMode) === targetMode;
      } else {
        matches = (fileMode & targetMode) !== 0;
      }
      return { matches, pruned: false, printed: false };
    }
    case "prune":
      // -prune always returns true and sets the prune flag
      return { matches: true, pruned: true, printed: false };
    case "print":
      // -print always returns true and sets the print flag
      return { matches: true, pruned: false, printed: true };
    case "not": {
      const inner = evaluateExpressionWithPrune(expr.expr, ctx);
      return { matches: !inner.matches, pruned: inner.pruned, printed: false };
    }
    case "and": {
      const left = evaluateExpressionWithPrune(expr.left, ctx);
      if (!left.matches) {
        // Short-circuit: if left is false, prune from left is still propagated
        return { matches: false, pruned: left.pruned, printed: false };
      }
      const right = evaluateExpressionWithPrune(expr.right, ctx);
      return {
        matches: right.matches,
        pruned: left.pruned || right.pruned,
        printed: left.printed || right.printed,
      };
    }
    case "or": {
      const left = evaluateExpressionWithPrune(expr.left, ctx);
      if (left.matches) {
        // Short-circuit: return left result (including prune and printed)
        return left;
      }
      const right = evaluateExpressionWithPrune(expr.right, ctx);
      return {
        matches: right.matches,
        pruned: left.pruned || right.pruned,
        printed: right.printed, // Only use right's printed since left didn't match
      };
    }
  }
}

/**
 * Check if an expression needs full stat metadata (size, mtime, mode)
 * vs just type info (isFile/isDirectory) which can come from dirent
 */
export function expressionNeedsStatMetadata(expr: Expression | null): boolean {
  if (!expr) return false;

  switch (expr.type) {
    // These only need name/path/type - available without stat
    case "name":
    case "path":
    case "regex":
    case "type":
    case "prune":
    case "print":
      return false;

    // These need stat metadata
    case "empty": // needs size for files
    case "mtime":
    case "newer":
    case "size":
    case "perm":
      return true;

    // Compound expressions - check children
    case "not":
      return expressionNeedsStatMetadata(expr.expr);
    case "and":
    case "or":
      return (
        expressionNeedsStatMetadata(expr.left) ||
        expressionNeedsStatMetadata(expr.right)
      );
  }
}

/**
 * Check if an expression uses -empty (needs directory entry count)
 */
export function expressionNeedsEmptyCheck(expr: Expression | null): boolean {
  if (!expr) return false;

  switch (expr.type) {
    case "empty":
      return true;
    case "not":
      return expressionNeedsEmptyCheck(expr.expr);
    case "and":
    case "or":
      return (
        expressionNeedsEmptyCheck(expr.left) ||
        expressionNeedsEmptyCheck(expr.right)
      );
    default:
      return false;
  }
}

// Helper to collect and resolve -newer reference file mtimes
export function collectNewerRefs(expr: Expression | null): string[] {
  const refs: string[] = [];

  const collect = (e: Expression | null): void => {
    if (!e) return;
    if (e.type === "newer") {
      refs.push(e.refPath);
    } else if (e.type === "not") {
      collect(e.expr);
    } else if (e.type === "and" || e.type === "or") {
      collect(e.left);
      collect(e.right);
    }
  };

  collect(expr);
  return refs;
}
