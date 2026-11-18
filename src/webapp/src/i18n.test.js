import { expect, test, vi } from 'vitest';

test('translation requests carry the build ID', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));

  const { default: i18n, i18nReady } = await import('./i18n');
  await i18nReady;

  expect(i18n.options.backend.queryStringParams.v).toBe(import.meta.env.VITE_BUILD_ID);
  expect(import.meta.env.VITE_BUILD_ID).toBeTruthy();

  vi.unstubAllGlobals();
});
