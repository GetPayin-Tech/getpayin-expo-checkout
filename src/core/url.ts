/**
 * A URL split into the parts the package compares on.
 *
 * Custom app schemes such as `myapp://payment-return` are not handled consistently by
 * the `URL` implementations across Hermes, JavaScriptCore and Node, so this package
 * parses them itself rather than depending on whichever one the host app ships.
 */
export interface ParsedUrl {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
}

const URL_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/)?([\s\S]*)$/;

/** Collapses a key or value to a form that compares across naming styles. */
export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]/g, '');
}

/** Strips a trailing slash so `/return` and `/return/` are one target. */
function normalizePath(path: string): string {
  const withLeadingSlash = path === '' || path.startsWith('/') ? path : `/${path}`;

  return withLeadingSlash.replace(/\/+$/, '');
}

/** Splits a URL into scheme, authority, path and query, dropping any fragment. */
export function parseUrl(raw: string): ParsedUrl | undefined {
  const withoutFragment = raw.trim().split('#')[0] ?? '';
  const queryIndex = withoutFragment.indexOf('?');
  const beforeQuery = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);
  const match = URL_PATTERN.exec(beforeQuery);

  if (!match) {
    return undefined;
  }

  const scheme = (match[1] ?? '').toLowerCase();
  const hasAuthority = match[2] !== undefined;
  const remainder = match[3] ?? '';

  if (!hasAuthority) {
    return { scheme, authority: '', path: normalizePath(remainder), query };
  }

  const pathIndex = remainder.indexOf('/');
  const authority = pathIndex === -1 ? remainder : remainder.slice(0, pathIndex);
  const path = pathIndex === -1 ? '' : remainder.slice(pathIndex);

  return { scheme, authority: authority.toLowerCase(), path: normalizePath(path), query };
}

/** True when both URLs address the same scheme, host and path, whatever their query. */
export function isSameTarget(a: string, b: string): boolean {
  const left = parseUrl(a);
  const right = parseUrl(b);

  if (!left || !right) {
    return false;
  }

  return (
    left.scheme === right.scheme && left.authority === right.authority && left.path === right.path
  );
}

/** Decodes one query name or value, leaving a malformed escape sequence as it was. */
export function decodeQueryComponent(value: string): string {
  const withSpaces = value.replace(/\+/g, ' ');

  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
}

/** Splits a query string into its raw, undecoded name and value pairs, in order. */
function queryPairs(query: string): [string, string][] {
  const pairs: [string, string][] = [];

  for (const pair of query.split('&')) {
    if (pair === '') {
      continue;
    }

    const separatorIndex = pair.indexOf('=');

    pairs.push(
      separatorIndex === -1
        ? [pair, '']
        : [pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1)],
    );
  }

  return pairs;
}

/**
 * Every field name in a query string exactly as sent, in order and undecoded.
 *
 * The return-link reader refuses a link carrying a name that only a looser reader would
 * take for one of its own fields — `Success`, `invoiceId`, `%73uccess` — so it has to see
 * the names the way the server checking the link's signature sees them, which is before
 * any decoding or case folding.
 */
export function rawQueryNames(query: string): string[] {
  return queryPairs(query).map(([name]) => name);
}

/**
 * Reads a query string into every value given for each name, in order.
 *
 * Names are decoded but otherwise kept exactly as sent, so `Success` is not `success`. A
 * return link has to be read the way the server that checks its signature reads it: if
 * the two could disagree about which value a field holds, a link could be signed for one
 * invoice and reported for another. Every value is kept so the caller can refuse a name
 * that appears more than once instead of picking one copy.
 *
 * A `Map`, not an object, so a name such as `__proto__` or `constructor` is just a name.
 */
export function readQuery(query: string): Map<string, string[]> {
  const params = new Map<string, string[]>();

  for (const [rawName, rawValue] of queryPairs(query)) {
    const name = decodeQueryComponent(rawName);
    const values = params.get(name);

    if (values === undefined) {
      params.set(name, [decodeQueryComponent(rawValue)]);
    } else {
      values.push(decodeQueryComponent(rawValue));
    }
  }

  return params;
}
