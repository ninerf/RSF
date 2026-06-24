import "server-only";

import type { ActorConfig } from "@/lib/types";

// Recursively replace {{placeholder}} tokens inside a JSON template with values
// from `values`. A string that is exactly "{{key}}" is replaced by the raw
// value (preserving type); placeholders embedded in a larger string are
// substituted as text.
function substitute(node: unknown, values: Record<string, unknown>): unknown {
  if (typeof node === "string") {
    const exact = node.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (exact) {
      const key = exact[1];
      return key in values ? values[key] : null;
    }
    return node.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) =>
      key in values ? String(values[key] ?? "") : "",
    );
  }
  if (Array.isArray(node)) {
    return node.map((n) => substitute(n, values));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = substitute(v, values);
    }
    return out;
  }
  return node;
}

// Drop keys whose value is null/"" so we don't send empty optional fields to
// providers that validate them.
function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// Build the provider input from a config + the user-supplied params.
// - url mode: { searchUrls: [{ url }], ...template } (the URL flows into the
//   template's placeholder, e.g. input_template references {{url}}).
// - form mode: substitute each input_field value into input_template.
export function buildInput(
  config: ActorConfig,
  userParams: Record<string, unknown>,
): Record<string, unknown> {
  const template = config.input_template ?? {};
  const merged = substitute(template, userParams) as Record<string, unknown>;
  return pruneEmpty(merged);
}
