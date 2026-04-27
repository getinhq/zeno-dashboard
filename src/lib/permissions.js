/**
 * Role-based UI helpers. Keep these pure so the Vitest smoke test can pin
 * them without instantiating React.
 *
 * The app_role enum lives in Postgres (`users.app_role`) and has four values:
 *   'artist' | 'pipeline' | 'supervisor' | 'production'
 *
 * Management = pipeline + supervisor + production.
 */

export const APP_ROLES = Object.freeze({
  ARTIST: 'artist',
  PIPELINE: 'pipeline',
  SUPERVISOR: 'supervisor',
  PRODUCTION: 'production',
});

export const MANAGEMENT_ROLES = Object.freeze([
  APP_ROLES.PIPELINE,
  APP_ROLES.SUPERVISOR,
  APP_ROLES.PRODUCTION,
]);

function _role(user) {
  return String(user?.app_role || '').toLowerCase();
}

export function isManagement(user) {
  return MANAGEMENT_ROLES.includes(_role(user));
}

export function isArtist(user) {
  return _role(user) === APP_ROLES.ARTIST;
}

export function canCreateTask(user) {
  return isManagement(user);
}

export function canAccessSettings(user) {
  return _role(user) === APP_ROLES.PIPELINE;
}

export function canCreateIssueFromWeb(user) {
  const r = _role(user);
  return r === APP_ROLES.SUPERVISOR || r === APP_ROLES.PRODUCTION || r === APP_ROLES.PIPELINE;
}

export function canViewUnassignedTasks(user) {
  return isManagement(user);
}

export function overviewMode(user) {
  return isArtist(user) ? 'artist' : 'management';
}

export function hasRole(user, ...roles) {
  const r = _role(user);
  return roles.map((x) => String(x).toLowerCase()).includes(r);
}

export default {
  APP_ROLES,
  MANAGEMENT_ROLES,
  isManagement,
  isArtist,
  canCreateTask,
  canAccessSettings,
  canCreateIssueFromWeb,
  canViewUnassignedTasks,
  overviewMode,
  hasRole,
};
