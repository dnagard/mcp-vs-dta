export async function httpGetBlob(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.arrayBuffer();
}

export async function httpGetArrayBuffer(url: string): Promise<ArrayBuffer> {
  // Alias for compatibility with other callers
  return httpGetBlob(url);
}

export async function httpGetJSON<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}
