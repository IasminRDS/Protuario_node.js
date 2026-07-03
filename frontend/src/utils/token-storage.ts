// Armazenamento dos tokens JWT (SSR-safe). Fonte única lida tanto pelo Axios
// quanto pela store de auth, evitando dessincronização.
const ACCESS_KEY = 'spe.accessToken';
const REFRESH_KEY = 'spe.refreshToken';

const hasWindow = () => typeof window !== 'undefined';

export const tokenStorage = {
  getAccess(): string | null {
    return hasWindow() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },
  getRefresh(): string | null {
    return hasWindow() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },
  set(accessToken: string, refreshToken: string): void {
    if (!hasWindow()) return;
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear(): void {
    if (!hasWindow()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};
