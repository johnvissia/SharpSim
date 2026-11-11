export const ADMIN_UIDS = [
  'bbISx7lZZiWXWJsdLk2NGjYTSdp2',
  '8n7fi9dV1LTnHpPUac4EEwxq1pB3',
  'JadnfCXFFuWsCwT34Ib4FawR8Yr2',
  'oVf8IM2uGkZv3qmYi5DvyTRqGnz2'
];

export function isUserAdmin(uid?: string | null): boolean {
  if (!uid) return false;
  return ADMIN_UIDS.includes(uid);
}
