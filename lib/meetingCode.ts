// Short meeting codes: three groups of three letters, e.g. "abc-def-ghi".

export const CODE_RE = /^[a-z]{3}-[a-z]{3}-[a-z]{3}$/;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Turn whatever someone typed or pasted into a meeting code:
 * "abc-def-ghi", "ABC DEF GHI", "abcdefghi" or a full link
 * (".../meet/abc-def-ghi"). Returns null if it isn't one.
 */
export function normalizeCode(input: string): string | null {
  let s = input.trim();
  // a pasted link: take what's after /meet/
  const fromLink = s.match(/\/meet\/([^/?#\s]+)/i);
  if (fromLink) s = decodeURIComponent(fromLink[1]);
  // only letters, separated by spaces or dashes
  if (!/^[a-z\s-]+$/i.test(s)) return null;
  const letters = s.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length !== 9) return null;
  return `${letters.slice(0, 3)}-${letters.slice(3, 6)}-${letters.slice(6, 9)}`;
}

/** What goes after /meet/ for a typed code or pasted link: a code or a meeting id */
export function meetingPathFromInput(input: string): string | null {
  return normalizeCode(input) ?? input.trim().match(UUID_RE)?.[0] ?? null;
}

/**
 * In-app link to a meeting: the short "/abc-def-ghi" when it has a code,
 * otherwise "/meet/<id>" (ad-hoc rooms, or before migration 0005)
 */
export const meetingHref = (m: { id: string; code?: string | null }) =>
  m.code ? `/${m.code}` : `/meet/${m.id}`;

/** Same, for whatever someone typed: a code becomes "/abc-def-ghi" */
export const hrefForPath = (path: string) => (CODE_RE.test(path) ? `/${path}` : `/meet/${path}`);
