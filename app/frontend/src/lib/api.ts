export { client } from './apiClient';
/**
 * Re-exported so consumers of this barrel can type what `client.auth.me()`
 * returns without reaching past it into apiClient. AuthContext already
 * imported CurrentUser from here and the type simply was not forwarded, so
 * the import resolved to nothing and `user` silently degraded to `any`.
 */
export type { CurrentUser } from './apiClient';
