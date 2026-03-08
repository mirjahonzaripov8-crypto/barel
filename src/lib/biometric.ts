// WebAuthn biometric helper for special logins
const CREDENTIAL_STORE_KEY = 'barel_webauthn_credentials';

interface StoredCredential {
  credentialId: string;
  loginKey: string; // 'superadmin' or 'looker'
}

function getStoredCredentials(): StoredCredential[] {
  try {
    return JSON.parse(localStorage.getItem(CREDENTIAL_STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCredential(cred: StoredCredential) {
  const all = getStoredCredentials();
  const existing = all.findIndex(c => c.loginKey === cred.loginKey);
  if (existing >= 0) all[existing] = cred;
  else all.push(cred);
  localStorage.setItem(CREDENTIAL_STORE_KEY, JSON.stringify(all));
}

function getCredentialForLogin(loginKey: string): StoredCredential | undefined {
  return getStoredCredentials().find(c => c.loginKey === loginKey);
}

// Convert between ArrayBuffer and base64
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function isWebAuthnSupported(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

// Register a new biometric credential
export async function registerBiometric(loginKey: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(loginKey);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'BAREL.uz',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: loginKey === 'superadmin' ? 'Super Admin' : 'Kuzatuvchi',
          displayName: loginKey === 'superadmin' ? 'Super Admin' : 'Kuzatuvchi',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Use built-in biometric (Face ID, Touch ID, Windows Hello)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential;

    if (credential) {
      saveCredential({
        credentialId: bufferToBase64(credential.rawId),
        loginKey,
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Biometric registration failed:', e);
    return false;
  }
}

// Verify biometric credential
export async function verifyBiometric(loginKey: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;

  const stored = getCredentialForLogin(loginKey);
  if (!stored) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64ToBuffer(stored.credentialId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
        rpId: window.location.hostname,
      },
    });

    return !!assertion;
  } catch (e) {
    console.error('Biometric verification failed:', e);
    return false;
  }
}

export function hasBiometricRegistered(loginKey: string): boolean {
  return !!getCredentialForLogin(loginKey);
}

export function getLoginKeyForCredentials(login: string): string | null {
  const upper = login.toUpperCase();
  if (upper === 'ZARIPOVM') return 'superadmin';
  return null;
}
