import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewNotificationCategory,
  getLiveNotificationCategory,
  getVisibleNotificationCategories,
} from '../lib/notificationAccess.mjs';

const permissions = {
  ADMIN: new Set(['FINANCE', 'PRODUCTION', 'STOCK']),
  MANAGER: new Set(['PRODUCTION', 'STOCK']),
  EMPLOYEE: new Set(['PRODUCTION', 'STOCK']),
  FINANCE: new Set(['FINANCE']),
};
const can = (role, section) => permissions[role]?.has(section) ?? false;

test('categories are limited to the caller role and unknown categories fail closed', () => {
  assert.deepEqual(getVisibleNotificationCategories('EMPLOYEE', can), [
    'MORTALITY', 'ENVIRONMENT', 'SHED_CAPACITY', 'PRODUCTION_DROP', 'FEED_STOCK',
  ]);
  assert.equal(canViewNotificationCategory('EMPLOYEE', 'ACCOUNTS_PAYABLE', can), false);
  assert.equal(canViewNotificationCategory('FINANCE', 'MORTALITY', can), false);
  assert.equal(canViewNotificationCategory('ADMIN', 'NEW_UNMAPPED_CATEGORY', can), false);
});

test('live alert ids map to the same section as their stored equivalents', () => {
  assert.equal(getLiveNotificationCategory('payable-123'), 'ACCOUNTS_PAYABLE');
  assert.equal(getLiveNotificationCategory('receivable-456'), 'ACCOUNTS_RECEIVABLE');
  assert.equal(getLiveNotificationCategory('shed-789'), 'SHED_CAPACITY');
  assert.equal(getLiveNotificationCategory('production-drop-789'), 'PRODUCTION_DROP');
  assert.equal(getLiveNotificationCategory('unknown-123'), null);
});
