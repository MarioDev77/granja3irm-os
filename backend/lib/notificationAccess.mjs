const NOTIFICATION_SECTIONS = Object.freeze({
  ACCOUNTS_PAYABLE: 'FINANCE',
  ACCOUNTS_RECEIVABLE: 'FINANCE',
  MORTALITY: 'PRODUCTION',
  ENVIRONMENT: 'PRODUCTION',
  SHED_CAPACITY: 'PRODUCTION',
  PRODUCTION_DROP: 'PRODUCTION',
  FEED_STOCK: 'STOCK',
});

export function getVisibleNotificationCategories(role, can) {
  return Object.entries(NOTIFICATION_SECTIONS)
    .filter(([, section]) => can(role, section))
    .map(([category]) => category);
}

export function canViewNotificationCategory(role, category, can) {
  return getVisibleNotificationCategories(role, can).includes(category);
}

export function getLiveNotificationCategory(id) {
  if (typeof id !== 'string') return null;
  if (id.startsWith('payable-')) return 'ACCOUNTS_PAYABLE';
  if (id.startsWith('receivable-')) return 'ACCOUNTS_RECEIVABLE';
  if (id.startsWith('shed-')) return 'SHED_CAPACITY';
  if (id.startsWith('production-drop-')) return 'PRODUCTION_DROP';
  return null;
}
