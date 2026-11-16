// Inicio de sesión con Microsoft (cuentas @gledcenter.com) usando el flujo de código con PKCE.
// No usa librerías externas ni secretos: el navegador obtiene un id_token y el servidor lo verifica.
const K = 'lt_ms_flujo';
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const redirectUri = () => `${location.origin}/`;

export async function iniciarMicrosoft(cfg) {
  const verifier = aleatorio(48);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const flujo = { verifier, state: aleatorio(16), nonce: aleatorio(16), tenantId: cfg.tenantId, clientId: cfg.clientId };
  sessionStorage.setItem(K, JSON.stringify(flujo));
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    state: flujo.state,
    nonce: flujo.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    domain_hint: cfg.dominio,
  });
  location.assign(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize?${p}`);
}

// Si la página volvió de Microsoft, canjea el código por el id_token. Devuelve null si no hay nada que completar.
export async function completarMicrosoft() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (!code && !error) return null;
  // limpiar la dirección (el código es de un solo uso y no debe quedar en el historial)
  history.replaceState(null, '', `${url.origin}${url.pathname}${url.hash}`);
  let flujo = null;
  try {
    flujo = JSON.parse(sessionStorage.getItem(K) || 'null');
  } catch {
    /* sin datos */
  }
  sessionStorage.removeItem(K);
  if (error) throw new Error(error.includes('AADSTS50020') ? 'Use su cuenta @gledcenter.com.' : 'No se completó el inicio de sesión con Microsoft.');
  if (!flujo || url.searchParams.get('state') !== flujo.state) throw new Error('El inicio de sesión con Microsoft no es válido. Intente de nuevo.');
  const r = await fetch(`https://login.microsoftonline.com/${flujo.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: flujo.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: flujo.verifier,
      scope: 'openid profile email',
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.id_token) throw new Error('Microsoft no confirmó el inicio de sesión. Intente de nuevo.');
  return { id_token: data.id_token, nonce: flujo.nonce };
}
