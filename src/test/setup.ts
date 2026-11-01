import '@testing-library/jest-dom/vitest';

// Keep unit tests offline: font auto-loading looks fonts up on Google Fonts.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('fonts.googleapis.com')) {
    return Promise.resolve(new Response('', { status: 404 }));
  }
  return realFetch(input, init);
}) as typeof fetch;
