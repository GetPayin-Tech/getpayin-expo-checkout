import Constants from 'expo-constants';

/** Reads a scheme value from the app config, which may be one string or a list. */
function schemesOf(value: unknown): string[] {
  const values: unknown[] = Array.isArray(value) ? value : [value];

  return values.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * The scheme expo-dev-client adds to a development build: `exp+` and the slug with every
 * character a scheme cannot hold removed, lowercased (expo-dev-client `getDefaultScheme`).
 */
function devClientSchemeOf(slug: unknown): string[] {
  if (typeof slug !== 'string') {
    return [];
  }

  const safe = slug.replace(/[^A-Za-z0-9+\-.]/g, '').toLowerCase();

  return safe === '' ? [] : [`exp+${safe}`];
}

/**
 * Every URL scheme the host app answers to, lowercased, read from its app config.
 *
 * The checkout refuses these whenever a link is not the return link. Refusing only the
 * return link's own scheme is not enough: Expo also registers the iOS bundle identifier as
 * a scheme, a development build adds `exp+<slug>`, and an app can list several schemes, so
 * a page inside the checkout could otherwise reach the app's deep-link routes through
 * another one. The Android package name is included too, and the development-build scheme
 * is included in every build; no bank app uses either, so refusing them costs nothing.
 *
 * Empty when the app config is not available, which leaves the return link's scheme as the
 * only one refused.
 */
export function hostAppSchemes(): string[] {
  const config = Constants.expoConfig;

  if (!config) {
    return [];
  }

  return [
    ...schemesOf(config.scheme),
    ...schemesOf(config.ios?.scheme),
    ...schemesOf(config.android?.scheme),
    ...schemesOf(config.ios?.bundleIdentifier),
    ...schemesOf(config.android?.package),
    ...devClientSchemeOf(config.slug),
  ].map((scheme) => scheme.trim().toLowerCase());
}
