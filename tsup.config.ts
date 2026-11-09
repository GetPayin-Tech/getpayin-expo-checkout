import { defineConfig } from 'tsup';

/*
 * One entry point. The package holds no secret and does no signing, so there is nothing to
 * split out the way the server SDK splits its browser entry: everything here is app-side.
 * React and the native modules stay external so the host app's single copy is the one used.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  external: [
    'react',
    'react-native',
    'react-native-safe-area-context',
    'react-native-webview',
    'expo-web-browser',
    'expo-linking',
    'expo-constants',
  ],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
