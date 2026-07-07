import {
  DYNAMO_TABLE_ENVS,
  putDynamoItem,
  upsertDynamoItem,
} from "./dynamo";

export type BetaApplicationRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  normalized_email: string;
  phone_raw?: string;
  phone_e164?: string;
  sms_opt_in: boolean;
  status: "new";
  source_page: string;
  created_at: string;
  updated_at: string;
};

export type EmailSubscriberRecord = {
  id: string;
  email: string;
  normalized_email: string;
  status: "subscribed";
  consent_timestamp: string;
  consent_source: string;
  created_at: string;
  updated_at: string;
  unsubscribe_token: string;
};

export type SmsSubscriberRecord = {
  id: string;
  phone_number_raw: string;
  phone_number_e164: string;
  status: "pending_verification";
  sms_consent_timestamp: string;
  sms_consent_source: string;
  opt_out_timestamp: string | null;
  created_at: string;
  updated_at: string;
};

export type BroadcastAuditRecord = {
  id: string;
  admin_identifier: string;
  channel: "email" | "sms" | "both";
  message_preview: string;
  intended_audience: string;
  target_count?: number;
  dry_run: boolean;
  status: "dry_run_recorded";
  created_at: string;
};

export async function saveBetaApplication(record: BetaApplicationRecord) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: record.id },
    operation: "save_beta_application",
    set: {
      first_name: record.first_name,
      last_name: record.last_name,
      email: record.email,
      normalized_email: record.normalized_email,
      phone_raw: record.phone_raw,
      phone_e164: record.phone_e164,
      sms_opt_in: record.sms_opt_in,
      source_page: record.source_page,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      status: record.status,
      created_at: record.created_at,
    },
  });
}

export async function saveEmailSubscriber(record: EmailSubscriberRecord) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
    key: { id: record.id },
    operation: "save_email_subscriber",
    set: {
      email: record.email,
      normalized_email: record.normalized_email,
      status: record.status,
      consent_timestamp: record.consent_timestamp,
      consent_source: record.consent_source,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      created_at: record.created_at,
      unsubscribe_token: record.unsubscribe_token,
    },
  });
}

export async function saveSmsSubscriber(record: SmsSubscriberRecord) {
  await upsertDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
    key: { id: record.id },
    operation: "save_sms_subscriber",
    set: {
      phone_number_raw: record.phone_number_raw,
      phone_number_e164: record.phone_number_e164,
      status: record.status,
      sms_consent_timestamp: record.sms_consent_timestamp,
      sms_consent_source: record.sms_consent_source,
      opt_out_timestamp: record.opt_out_timestamp,
      updated_at: record.updated_at,
    },
    setIfNotExists: {
      id: record.id,
      created_at: record.created_at,
    },
  });
}

export async function saveBroadcastAudit(record: BroadcastAuditRecord) {
  await putDynamoItem(
    DYNAMO_TABLE_ENVS.broadcastAuditLogs,
    record,
    "save_broadcast_audit",
  );
}
