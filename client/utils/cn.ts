// client/utils/cn.ts
// Minimal className combiner — no new dependency needed (clsx-style, tiny).

export type ClassValue = string | number | boolean | undefined | null | { [key: string]: any } | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      out.push(input);
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else if (typeof input === 'object') {
      for (const key in input) {
        if ((input as Record<string, any>)[key]) out.push(key);
      }
    }
  }
  return out.join(' ');
}

export default cn;
