// Mirrors backend/src/audit-log/audit-actions.ts. Frontend and backend
// don't share a types/constants package here, so this list is duplicated
// by hand — keep it in sync if a new call site starts recording a new
// action.
export const AUDIT_ACTIONS = [
  "mark_paid",
  "resend_ticket",
  "void_ticket",
  "cancel_registration",
  "send_pending_payment_reminder",
  "create_admin_user",
  "update_admin_user",
  "delete_admin_user",
  "update_event_settings",
  "update_ticket_product",
  "create_speaker",
  "update_speaker",
  "delete_speaker",
  "create_sponsor",
  "update_sponsor",
  "delete_sponsor",
  "approve_sponsor_application",
  "reject_sponsor_application",
  "create_coupon",
  "update_coupon",
  "delete_coupon",
  "approve_volunteer_application",
  "reject_volunteer_application",
  "delete_newsletter_subscriber",
  "offline_sync_conflict",
] as const;
