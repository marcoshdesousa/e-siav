// Cliente HTTP da API do App do DBV.
async function request(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api' + url, opts);
  } catch {
    // Sem internet (ou servidor inalcançável).
    const err = new Error('Sem internet. Conecte-se para usar esta parte do app.');
    err.offline = true;
    throw err;
  }
  // Servidor fora do ar (atualização ou erro): vai para a tela "Sistema em atualização".
  if ([502, 503, 504].includes(res.status)) {
    location.replace('/atualizando.html?volta=' + encodeURIComponent(location.pathname + location.search));
    throw new Error('Sistema em atualização');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || 'Algo deu errado. Tente de novo.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

/** Monta FormData a partir de um objeto (arquivos e campos). */
export function toForm(obj) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v[0] instanceof File) v.forEach((f) => fd.append(k, f));
    else if (v instanceof Blob) fd.append(k, v, v.name || k);
    else fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return fd;
}
