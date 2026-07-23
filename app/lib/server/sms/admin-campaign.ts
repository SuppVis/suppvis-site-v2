export function areAdminSmsAnnouncementsEnabled() {
  return process.env.ADMIN_SMS_ANNOUNCEMENTS_ENABLED === "true";
}

export function isAdminSmsTestSendEnabled() {
  return process.env.ADMIN_SMS_TEST_SEND_ENABLED === "true";
}

export function isAdminSmsBulkSendEnabled() {
  return process.env.ADMIN_SMS_BULK_SEND_ENABLED === "true";
}

export function isAdminSmsBulkInfraReady() {
  return process.env.ADMIN_SMS_BULK_SEND_INFRA_READY === "true";
}
