export const fetcher = async (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
) => {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`Request failed with HTTP ${res.status}`);
  return res.json();
};
