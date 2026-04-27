import { describe, it, expect } from 'vitest';
import {
  APP_ROLES,
  canAccessSettings,
  canCreateIssueFromWeb,
  canCreateTask,
  hasRole,
  isArtist,
  isManagement,
  overviewMode,
} from './permissions';

function user(appRole) {
  return { id: 'u1', username: 'u', app_role: appRole };
}

describe('permissions', () => {
  it('management roles can create tasks', () => {
    expect(canCreateTask(user(APP_ROLES.PIPELINE))).toBe(true);
    expect(canCreateTask(user(APP_ROLES.SUPERVISOR))).toBe(true);
    expect(canCreateTask(user(APP_ROLES.PRODUCTION))).toBe(true);
  });

  it('artists cannot create tasks', () => {
    expect(canCreateTask(user(APP_ROLES.ARTIST))).toBe(false);
  });

  it('only pipeline accesses settings', () => {
    expect(canAccessSettings(user(APP_ROLES.PIPELINE))).toBe(true);
    expect(canAccessSettings(user(APP_ROLES.SUPERVISOR))).toBe(false);
    expect(canAccessSettings(user(APP_ROLES.ARTIST))).toBe(false);
  });

  it('artists cannot create issues from web', () => {
    expect(canCreateIssueFromWeb(user(APP_ROLES.ARTIST))).toBe(false);
    expect(canCreateIssueFromWeb(user(APP_ROLES.SUPERVISOR))).toBe(true);
    expect(canCreateIssueFromWeb(user(APP_ROLES.PRODUCTION))).toBe(true);
  });

  it('overviewMode switches for artists', () => {
    expect(overviewMode(user(APP_ROLES.ARTIST))).toBe('artist');
    expect(overviewMode(user(APP_ROLES.PIPELINE))).toBe('management');
  });

  it('isManagement / isArtist flags', () => {
    expect(isManagement(user(APP_ROLES.PRODUCTION))).toBe(true);
    expect(isArtist(user(APP_ROLES.ARTIST))).toBe(true);
    expect(isArtist(user(APP_ROLES.PIPELINE))).toBe(false);
  });

  it('hasRole matches case-insensitively', () => {
    expect(hasRole(user('Pipeline'), 'pipeline')).toBe(true);
    expect(hasRole(user('artist'), 'PIPELINE', 'SUPERVISOR')).toBe(false);
  });

  it('handles nullish users gracefully', () => {
    expect(isManagement(null)).toBe(false);
    expect(overviewMode(null)).toBe('management');
    expect(canCreateTask(undefined)).toBe(false);
  });
});
