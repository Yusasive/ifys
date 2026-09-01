// Every action string currently passed to AuditLogService#record() across
// the codebase, kept here as a single shared list so the admin frontend's
// audit-log filter dropdown has options that actually match what gets
// written. Not enforced at the DB or DTO level (AuditLog.action is a plain
// string) — if you add a new call site with a new action name, add it here
// too so it shows up as a filter option.
export const AUDIT_ACTIONS = [
  'mark_paid',
  'resend_ticket',
  'void_ticket',
  'cancel_registration',
  'approve_student_registration',
  'reject_student_registration',
  'send_pending_payment_reminder',
  'create_admin_user',
  'update_admin_user',
  'delete_admin_user',
  'update_event_settings',
  'update_ticket_product',
  'create_speaker',
  'update_speaker',
  'delete_speaker',
  'create_sponsor',
  'update_sponsor',
  'delete_sponsor',
  'approve_sponsor_application',
  'reject_sponsor_application',
  'create_coupon',
  'update_coupon',
  'delete_coupon',
  'approve_volunteer_application',
  'reject_volunteer_application',
  'delete_newsletter_subscriber',
  'offline_sync_conflict',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
