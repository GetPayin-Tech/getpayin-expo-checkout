import Constants from 'expo-constants';

/** Reads one property off a value that may not be an object at all. */
function readProperty(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

/** The entries of a value that should be a list, or nothing when it is not one. */
function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Reduces a scheme to the form a parsed URL's scheme is compared against.
 *
 * `"myapp://"` and `"myapp:"` are both written in app configs, and neither would ever
 * equal the `myapp` a URL parses to.
 */
function normalizeScheme(scheme: string): string {
  return scheme.trim().toLowerCase().replace(/:\/*$/, '');
}

/** Reads a scheme value from the app config, which may be one string or a list. */
function schemesOf(value: unknown): string[] {
  const values: unknown[] = Array.isArray(value) ? value : [value];

  return values
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(normalizeScheme)
    .filter((scheme) => scheme !== '');
}

/**
 * The schemes declared through Android intent filters.
 *
 * `android.intentFilters[].data[].scheme` is how an app registers a deep link that is not
 * its single `scheme`, so a page inside the checkout could otherwise reach those routes.
 */
function intentFilterSchemes(android: unknown): string[] {
  return listOf(readProperty(android, 'intentFilters')).flatMap((filter) =>
    listOf(readProperty(filter, 'data')).flatMap((data) => schemesOf(readProperty(data, 'scheme'))),
  );
}

/**
 * The schemes declared straight into the iOS `Info.plist`.
 *
 * `ios.infoPlist.CFBundleURLTypes` is an untyped passthrough in the Expo config and the
 * only way to register several iOS schemes on some setups.
 */
function bundleUrlSchemes(ios: unknown): string[] {
  return listOf(readProperty(readProperty(ios, 'infoPlist'), 'CFBundleURLTypes')).flatMap((type) =>
    schemesOf(readProperty(type, 'CFBundleURLSchemes')),
  );
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
 * Every URL scheme an Expo app config says the app answers to, lowercased and deduplicated.
 *
 * Taken as a value rather than read from the environment, so the rule can be tested
 * against a real config and reused by an app that holds its own.
 */
export function schemesFromAppConfig(config: unknown): string[] {
  const ios = readProperty(config, 'ios');
  const android = readProperty(config, 'android');

  return [
    ...new Set([
      ...schemesOf(readProperty(config, 'scheme')),
      ...schemesOf(readProperty(ios, 'scheme')),
      ...schemesOf(readProperty(android, 'scheme')),
      ...schemesOf(readProperty(ios, 'bundleIdentifier')),
      ...schemesOf(readProperty(android, 'package')),
      ...bundleUrlSchemes(ios),
      ...intentFilterSchemes(android),
      ...devClientSchemeOf(readProperty(config, 'slug')),
    ]),
  ];
}

/**
 * The app config, or `undefined` when this build cannot produce one.
 *
 * `Constants.expoConfig` is a getter, and it throws `ERR_CONSTANTS_MANIFEST_UNAVAILABLE`
 * rather than returning null in a store or standalone build whose manifest is not embedded.
 * This is read while the checkout screen renders, so an uncaught throw would unmount the
 * screen without `onComplete` or `onCancel` ever being called, leaving `open()` pending and
 * the session guard busy for the rest of the process.
 */
function readAppConfig(): unknown {
  try {
    return Constants.expoConfig;
  } catch {
    return undefined;
  }
}

/**
 * Every URL scheme the host app answers to, lowercased, read from its app config.
 *
 * The checkout refuses these whenever a link is not the return link. Refusing only the
 * return link's own scheme is not enough: Expo also registers the iOS bundle identifier as
 * a scheme, a development build adds `exp+<slug>`, and an app can list several schemes
 * through `scheme`, an Android intent filter or `CFBundleURLTypes`, so a page inside the
 * checkout could otherwise reach the app's deep-link routes through another one. The
 * Android package name is included too, and the development-build scheme is included in
 * every build; no bank app uses either, so refusing them costs nothing.
 *
 * Empty when the app config is not available, which leaves the return link's scheme as the
 * only one refused. A bare React Native app with no Expo config is the usual case; it can
 * pass its own list to `createNavigationHandler` instead.
 */
export function hostAppSchemes(): string[] {
  return schemesFromAppConfig(readAppConfig());
}
