import { stableId } from "./crypto";
import {
  DYNAMO_TABLE_ENVS,
  batchGetDynamoItems,
  getDynamoItem,
  incrementDynamoItem,
  scanDynamoItemsPage,
  updateDynamoItem,
} from "./dynamo";
import {
  compareForSignupOrderBackfill,
  getPriorityBetaLimit,
  priorityBadgeLabel,
  shouldAutoAssignPriority,
  type BetaAudienceSegment,
} from "./beta-priority";
import type {
  BetaApplicationRecord,
  EmailSubscriberRecord,
  SmsSubscriberRecord,
} from "./persistence";

const BETA_SUBSCRIBER_METADATA_ID = "__beta_subscriber_metadata__";
const DEFAULT_ADMIN_SUBSCRIBER_PAGE_SIZE = 20;

export type AdminSubscriberSort =
  | "name_asc"
  | "newest"
  | "signup_order_asc";

export type AdminSubscriberPriorityFilter =
  | "all"
  | "priority"
  | "standard";

export type AdminBetaSubscriber = {
  adminNotes: string;
  adminNotesUpdatedAt: string | null;
  createdAt: string;
  email: string;
  emailDelivery: {
    lastEmailMessageId: string | null;
    lastEmailSentAt: string | null;
    lastEmailType: string | null;
    welcomeEmailSentAt: string | null;
  };
  emailStatus: string;
  firstName: string;
  fullName: string;
  id: string;
  lastName: string;
  phoneE164: string | null;
  phoneRaw: string | null;
  priorityBadge: string;
  priorityBeta: boolean;
  priorityUpdatedAt: string | null;
  signupOrderNumber: number | null;
  smsConsent: {
    informational: boolean;
    informationalAt: string | null;
    marketing: boolean;
    marketingAt: string | null;
    version: string | null;
  };
  smsDelivery: {
    lastSmsMessageSid: string | null;
    lastSmsSentAt: string | null;
    lastSmsStatus: string | null;
    providerStatus: string | null;
    welcomeSmsSentAt: string | null;
  };
  smsStatus: string;
  sourcePage: string;
  subscriberAdminVersion: number;
  updatedAt: string;
};

export type AdminSubscriberListResult = {
  backfillNeeded: boolean;
  items: AdminBetaSubscriber[];
  page: number;
  pageSize: number;
  priorityCount: number;
  priorityLimit: number;
  totalCount: number;
  totalPages: number;
};

export type AdminSubscriberCollectionResult = {
  backfillNeeded: boolean;
  items: AdminBetaSubscriber[];
  priorityCount: number;
  priorityLimit: number;
  totalCount: number;
};

type SubscriberSearchMatch = {
  score: number;
  subscriber: AdminBetaSubscriber;
};

function stringAttribute(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function nullableStringAttribute(value: unknown) {
  return value === null ? null : stringAttribute(value);
}

function booleanAttribute(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function numberAttribute(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function betaApplicationFromItem(
  item: Record<string, unknown> | undefined,
): BetaApplicationRecord | null {
  const id = stringAttribute(item?.id);
  const firstName = stringAttribute(item?.first_name);
  const lastName = stringAttribute(item?.last_name);
  const email = stringAttribute(item?.email);
  const normalizedEmail = stringAttribute(item?.normalized_email);
  const status = stringAttribute(item?.status);
  const sourcePage = stringAttribute(item?.source_page);
  const createdAt = stringAttribute(item?.created_at);
  const updatedAt = stringAttribute(item?.updated_at);

  if (
    !id ||
    id.startsWith("__") ||
    !firstName ||
    !lastName ||
    !email ||
    !normalizedEmail ||
    status !== "new" ||
    !sourcePage ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    record_type: "beta_application",
    first_name: firstName,
    last_name: lastName,
    email,
    normalized_email: normalizedEmail,
    phone_raw: stringAttribute(item?.phone_raw),
    phone_e164: stringAttribute(item?.phone_e164),
    sms_opt_in: booleanAttribute(item?.sms_opt_in) || false,
    legacy_sms_consent: booleanAttribute(item?.legacy_sms_consent),
    sms_informational_consent:
      booleanAttribute(item?.sms_informational_consent) || false,
    sms_marketing_consent:
      booleanAttribute(item?.sms_marketing_consent) || false,
    sms_consent_version:
      stringAttribute(item?.sms_consent_version) || "unknown",
    status: "new",
    source_page: sourcePage,
    signup_order_number: numberAttribute(item?.signup_order_number),
    signup_order_assigned_at: stringAttribute(item?.signup_order_assigned_at),
    priority_beta: booleanAttribute(item?.priority_beta),
    priority_beta_assigned_at:
      nullableStringAttribute(item?.priority_beta_assigned_at) || null,
    priority_beta_removed_at:
      nullableStringAttribute(item?.priority_beta_removed_at) || null,
    priority_beta_removed_reason:
      item?.priority_beta_removed_reason === "admin" ||
      item?.priority_beta_removed_reason === "unsubscribe"
        ? item.priority_beta_removed_reason
        : null,
    priority_beta_updated_at:
      nullableStringAttribute(item?.priority_beta_updated_at) || null,
    priority_beta_updated_by:
      nullableStringAttribute(item?.priority_beta_updated_by) || null,
    admin_notes: stringAttribute(item?.admin_notes) || "",
    admin_notes_updated_at:
      nullableStringAttribute(item?.admin_notes_updated_at) || null,
    admin_notes_updated_by:
      nullableStringAttribute(item?.admin_notes_updated_by) || null,
    subscriber_admin_version:
      numberAttribute(item?.subscriber_admin_version) || 1,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function emailSubscriberFromItem(
  item: Record<string, unknown> | undefined,
): Partial<EmailSubscriberRecord> | null {
  const id = stringAttribute(item?.id);

  if (!id) {
    return null;
  }

  return {
    id,
    email: stringAttribute(item?.email) || "",
    normalized_email: stringAttribute(item?.normalized_email) || "",
    status: (stringAttribute(item?.status) ||
      "unknown") as EmailSubscriberRecord["status"],
    consent_timestamp: stringAttribute(item?.consent_timestamp) || "",
    consent_source: stringAttribute(item?.consent_source) || "",
    created_at: stringAttribute(item?.created_at) || "",
    updated_at: stringAttribute(item?.updated_at) || "",
    unsubscribe_token: stringAttribute(item?.unsubscribe_token) || "",
    last_email_sent_at: stringAttribute(item?.last_email_sent_at),
    last_email_message_id: stringAttribute(item?.last_email_message_id),
    last_email_type: stringAttribute(item?.last_email_type) as
      | EmailSubscriberRecord["last_email_type"]
      | undefined,
    welcome_email_sent_at: stringAttribute(item?.welcome_email_sent_at),
  };
}

function smsSubscriberFromItem(
  item: Record<string, unknown> | undefined,
): Partial<SmsSubscriberRecord> | null {
  const id = stringAttribute(item?.id);

  if (!id) {
    return null;
  }

  return {
    id,
    phone_number_raw: stringAttribute(item?.phone_number_raw) || "",
    phone_number_e164: stringAttribute(item?.phone_number_e164) || "",
    status: (stringAttribute(item?.status) ||
      "unknown") as SmsSubscriberRecord["status"],
    sms_informational_consent:
      booleanAttribute(item?.sms_informational_consent) || false,
    sms_informational_consent_at:
      nullableStringAttribute(item?.sms_informational_consent_at) || null,
    sms_marketing_consent:
      booleanAttribute(item?.sms_marketing_consent) || false,
    sms_marketing_consent_at:
      nullableStringAttribute(item?.sms_marketing_consent_at) || null,
    sms_consent_timestamp: stringAttribute(item?.sms_consent_timestamp) || "",
    sms_consent_source: stringAttribute(item?.sms_consent_source) || "",
    sms_consent_version: stringAttribute(item?.sms_consent_version) || "",
    sms_global_opt_out: booleanAttribute(item?.sms_global_opt_out) || false,
    sms_global_opt_out_at:
      nullableStringAttribute(item?.sms_global_opt_out_at) || null,
    opt_out_timestamp: nullableStringAttribute(item?.opt_out_timestamp) || null,
    welcome_sms_sent_at: stringAttribute(item?.welcome_sms_sent_at),
    last_sms_sent_at: stringAttribute(item?.last_sms_sent_at),
    last_sms_message_sid: stringAttribute(item?.last_sms_message_sid),
    last_sms_status: stringAttribute(item?.last_sms_status),
    sms_provider_status: stringAttribute(item?.sms_provider_status),
    created_at: stringAttribute(item?.created_at) || "",
    updated_at: stringAttribute(item?.updated_at) || "",
  };
}

async function scanBetaApplications() {
  const applications: BetaApplicationRecord[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await scanDynamoItemsPage({
      tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
      exclusiveStartKey,
      limit: 250,
      operation: "scan_beta_applications_for_admin",
    });

    for (const item of page.items) {
      const application = betaApplicationFromItem(item);

      if (application) {
        applications.push(application);
      }
    }

    exclusiveStartKey = page.lastEvaluatedKey;
  } while (exclusiveStartKey);

  return applications;
}

function deriveEffectiveBetaApplications(
  applications: BetaApplicationRecord[],
  input?: { now?: string },
) {
  const now = input?.now || new Date().toISOString();
  const priorityLimit = getPriorityBetaLimit();
  const usedSignupOrders = new Set(
    applications
      .map((application) => application.signup_order_number)
      .filter((order): order is number => Boolean(order && order > 0)),
  );
  const orderById = new Map<string, number>();
  let nextSignupOrder = 1;

  for (const application of [...applications].sort(compareForSignupOrderBackfill)) {
    if (application.signup_order_number && application.signup_order_number > 0) {
      orderById.set(application.id, application.signup_order_number);
      nextSignupOrder = Math.max(
        nextSignupOrder,
        application.signup_order_number + 1,
      );
      continue;
    }

    while (usedSignupOrders.has(nextSignupOrder)) {
      nextSignupOrder += 1;
    }

    orderById.set(application.id, nextSignupOrder);
    usedSignupOrders.add(nextSignupOrder);
    nextSignupOrder += 1;
  }

  return applications.map((application) => {
    const signupOrderNumber =
      orderById.get(application.id) || application.signup_order_number || null;
    const priorityMissing = application.priority_beta === undefined;
    const priorityBeta = priorityMissing
      ? Boolean(signupOrderNumber && signupOrderNumber <= priorityLimit)
      : Boolean(application.priority_beta);

    return {
      ...application,
      record_type: "beta_application" as const,
      signup_order_number:
        signupOrderNumber || application.signup_order_number || undefined,
      signup_order_assigned_at:
        application.signup_order_assigned_at || application.created_at || now,
      priority_beta: priorityBeta,
      priority_beta_assigned_at: priorityBeta
        ? application.priority_beta_assigned_at || application.created_at || now
        : application.priority_beta_assigned_at || null,
      priority_beta_removed_at: priorityBeta
        ? null
        : application.priority_beta_removed_at || null,
      priority_beta_removed_reason: priorityBeta
        ? null
        : application.priority_beta_removed_reason || null,
      priority_beta_updated_at:
        application.priority_beta_updated_at || application.updated_at || now,
      priority_beta_updated_by:
        application.priority_beta_updated_by ||
        (priorityMissing ? "system:derived" : null),
      subscriber_admin_version: application.subscriber_admin_version || 1,
    } satisfies BetaApplicationRecord;
  });
}

async function scanEffectiveBetaApplications(input?: { now?: string }) {
  return deriveEffectiveBetaApplications(await scanBetaApplications(), input);
}

async function getBetaSubscriberMetadata() {
  return getDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: BETA_SUBSCRIBER_METADATA_ID },
    operation: "get_beta_subscriber_metadata",
  });
}

async function setBetaSubscriberMetadata(input: {
  lastSignupOrderNumber: number;
  now: string;
  priorityCount: number;
}) {
  await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: BETA_SUBSCRIBER_METADATA_ID },
    operation: "set_beta_subscriber_metadata",
    set: {
      id: BETA_SUBSCRIBER_METADATA_ID,
      record_type: "beta_subscriber_metadata",
      last_signup_order_number: input.lastSignupOrderNumber,
      priority_count: input.priorityCount,
      updated_at: input.now,
    },
  });
}

export async function backfillBetaSubscriberMetadata(input?: {
  now?: string;
}) {
  const now = input?.now || new Date().toISOString();
  const priorityLimit = getPriorityBetaLimit();
  const rawApplications = await scanBetaApplications();
  const rawById = new Map(
    rawApplications.map((application) => [application.id, application]),
  );
  const applications = deriveEffectiveBetaApplications(rawApplications, {
    now,
  }).sort(
    compareForSignupOrderBackfill,
  );
  let nextOrder = 1;
  let priorityCount = 0;
  let updatedCount = 0;

  for (const application of applications) {
    const original = rawById.get(application.id);
    const signupOrderNumber = application.signup_order_number || nextOrder;
    const missingOrder = !original?.signup_order_number;
    const priorityMissing = original?.priority_beta === undefined;
    const shouldBePriority = Boolean(application.priority_beta);
    const nextAdminVersion = (application.subscriber_admin_version || 1) + 1;

    if (shouldBePriority) {
      priorityCount += 1;
    }

    if (
      missingOrder ||
      priorityMissing ||
      !application.record_type ||
      !application.subscriber_admin_version
    ) {
      await updateDynamoItem({
        tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
        key: { id: application.id },
        operation: "backfill_beta_subscriber_metadata",
        set: {
          record_type: "beta_application",
          signup_order_number: signupOrderNumber,
          signup_order_assigned_at:
            original?.signup_order_assigned_at || application.created_at || now,
          priority_beta: shouldBePriority,
          priority_beta_assigned_at: shouldBePriority
            ? original?.priority_beta_assigned_at ||
              application.priority_beta_assigned_at ||
              now
            : null,
          priority_beta_removed_at: shouldBePriority
            ? null
            : original?.priority_beta_removed_at ||
              application.priority_beta_removed_at ||
              null,
          priority_beta_removed_reason: shouldBePriority
            ? null
            : original?.priority_beta_removed_reason ||
              application.priority_beta_removed_reason ||
              null,
          priority_beta_updated_at:
            original?.priority_beta_updated_at ||
            application.priority_beta_updated_at ||
            now,
          priority_beta_updated_by:
            original?.priority_beta_updated_by || "system:backfill",
          subscriber_admin_version: nextAdminVersion,
          updated_at: application.updated_at,
        },
        conditionExpression: "attribute_exists(#id)",
        conditionAttributeNames: {
          "#id": "id",
        },
      });
      updatedCount += 1;
    }

    nextOrder = Math.max(nextOrder, signupOrderNumber + 1);
  }

  await setBetaSubscriberMetadata({
    lastSignupOrderNumber: nextOrder - 1,
    now,
    priorityCount,
  });

  return {
    backfilledCount: updatedCount,
    examinedCount: applications.length,
    lastSignupOrderNumber: nextOrder - 1,
    priorityCount,
    priorityLimit,
  };
}

export async function reserveNextBetaSignupOrder(input?: { now?: string }) {
  const now = input?.now || new Date().toISOString();
  const metadata = await getBetaSubscriberMetadata();

  if (!numberAttribute(metadata?.last_signup_order_number)) {
    await backfillBetaSubscriberMetadata({ now });
  }

  const result = await incrementDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: BETA_SUBSCRIBER_METADATA_ID },
    operation: "reserve_beta_signup_order",
    add: {
      last_signup_order_number: 1,
    },
    set: {
      record_type: "beta_subscriber_metadata",
      updated_at: now,
    },
    returnValues: "ALL_NEW",
  });

  return numberAttribute(result.attributes?.last_signup_order_number) || 1;
}

export async function getBetaApplicationById(id: string) {
  const item = await getDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id },
    operation: "get_beta_application",
  });

  return betaApplicationFromItem(item);
}

async function getEffectiveBetaApplicationById(id: string) {
  const applications = await scanEffectiveBetaApplications();

  return applications.find((application) => application.id === id) || null;
}

async function joinSubscriberRecords(applications: BetaApplicationRecord[]) {
  const emailKeys = applications.map((application) => ({
    id: stableId("email", application.normalized_email),
  }));
  const smsKeys = applications
    .map((application) =>
      application.phone_e164 ? { id: stableId("sms", application.phone_e164) } : null,
    )
    .filter((key): key is { id: string } => Boolean(key));
  const [emailItems, smsItems] = await Promise.all([
    emailKeys.length
      ? batchGetDynamoItems({
          tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
          keys: emailKeys,
          operation: "admin_join_email_subscribers",
        })
      : [],
    smsKeys.length
      ? batchGetDynamoItems({
          tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
          keys: smsKeys,
          operation: "admin_join_sms_subscribers",
        })
      : [],
  ]);
  const emailById = new Map(
    emailItems
      .map((item) => emailSubscriberFromItem(item))
      .filter((item): item is Partial<EmailSubscriberRecord> => Boolean(item))
      .map((item) => [item.id, item]),
  );
  const smsById = new Map(
    smsItems
      .map((item) => smsSubscriberFromItem(item))
      .filter((item): item is Partial<SmsSubscriberRecord> => Boolean(item))
      .map((item) => [item.id, item]),
  );

  return {
    emailById,
    smsById,
  };
}

function subscriberProfileFromRecords(input: {
  application: BetaApplicationRecord;
  emailSubscriber?: Partial<EmailSubscriberRecord>;
  priorityLimit: number;
  smsSubscriber?: Partial<SmsSubscriberRecord>;
}): AdminBetaSubscriber {
  const application = input.application;
  const fullName = `${application.first_name} ${application.last_name}`.trim();
  const smsSubscriber = input.smsSubscriber;
  const emailSubscriber = input.emailSubscriber;

  return {
    adminNotes: application.admin_notes || "",
    adminNotesUpdatedAt: application.admin_notes_updated_at || null,
    createdAt: application.created_at,
    email: application.email,
    emailDelivery: {
      lastEmailMessageId: emailSubscriber?.last_email_message_id || null,
      lastEmailSentAt: emailSubscriber?.last_email_sent_at || null,
      lastEmailType: emailSubscriber?.last_email_type || null,
      welcomeEmailSentAt: emailSubscriber?.welcome_email_sent_at || null,
    },
    emailStatus: emailSubscriber?.status || "missing",
    firstName: application.first_name,
    fullName,
    id: application.id,
    lastName: application.last_name,
    phoneE164: application.phone_e164 || null,
    phoneRaw: application.phone_raw || application.phone_e164 || null,
    priorityBadge: priorityBadgeLabel({
      isPriority: Boolean(application.priority_beta),
      priorityLimit: input.priorityLimit,
    }),
    priorityBeta: Boolean(application.priority_beta),
    priorityUpdatedAt: application.priority_beta_updated_at || null,
    signupOrderNumber: application.signup_order_number || null,
    smsConsent: {
      informational: Boolean(application.sms_informational_consent),
      informationalAt: smsSubscriber?.sms_informational_consent_at || null,
      marketing: Boolean(application.sms_marketing_consent),
      marketingAt: smsSubscriber?.sms_marketing_consent_at || null,
      version: application.sms_consent_version || null,
    },
    smsDelivery: {
      lastSmsMessageSid: smsSubscriber?.last_sms_message_sid || null,
      lastSmsSentAt: smsSubscriber?.last_sms_sent_at || null,
      lastSmsStatus: smsSubscriber?.last_sms_status || null,
      providerStatus: smsSubscriber?.sms_provider_status || null,
      welcomeSmsSentAt: smsSubscriber?.welcome_sms_sent_at || null,
    },
    smsStatus: smsSubscriber?.status || (application.phone_e164 ? "missing" : "none"),
    sourcePage: application.source_page,
    subscriberAdminVersion: application.subscriber_admin_version || 1,
    updatedAt: application.updated_at,
  };
}

function sortSubscribers(
  subscribers: AdminBetaSubscriber[],
  sort: AdminSubscriberSort,
) {
  return [...subscribers].sort((a, b) => compareSubscribers(a, b, sort));
}

function compareSubscribers(
  a: AdminBetaSubscriber,
  b: AdminBetaSubscriber,
  sort: AdminSubscriberSort,
) {
  const byOrderAsc = (left: AdminBetaSubscriber, right: AdminBetaSubscriber) =>
    (left.signupOrderNumber || Number.MAX_SAFE_INTEGER) -
      (right.signupOrderNumber || Number.MAX_SAFE_INTEGER) ||
    left.fullName.localeCompare(right.fullName);

  if (sort === "name_asc") {
    return a.fullName.localeCompare(b.fullName) || byOrderAsc(a, b);
  }

  if (sort === "newest") {
    return b.createdAt.localeCompare(a.createdAt) || byOrderAsc(a, b);
  }

  return byOrderAsc(a, b);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function phoneSearchDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function phoneDigitsMatchScore(source: string, query: string) {
  if (!source || !query) {
    return null;
  }

  const localSource =
    source.length === 11 && source.startsWith("1") ? source.slice(1) : source;
  const localQuery =
    query.length === 11 && query.startsWith("1") ? query.slice(1) : query;

  if (source === query || localSource === localQuery) {
    return 130;
  }

  if (source.startsWith(query) || localSource.startsWith(localQuery)) {
    return 105;
  }

  if (source.includes(query) || localSource.includes(localQuery)) {
    return 65;
  }

  return null;
}

function isSubsequenceMatch(source: string, query: string) {
  if (query.length < 3) {
    return false;
  }

  let queryIndex = 0;

  for (const character of source) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === query.length) {
      return true;
    }
  }

  return false;
}

function textMatchScore(source: string | null | undefined, query: string) {
  const value = normalizeSearchText(source || "");

  if (!value || !query) {
    return null;
  }

  if (value === query) {
    return 125;
  }

  if (value.startsWith(query)) {
    return 110;
  }

  if (value.includes(` ${query}`)) {
    return 95;
  }

  if (value.includes(query)) {
    return 70;
  }

  return isSubsequenceMatch(value, query) ? 25 : null;
}

function subscriberSearchScore(
  subscriber: AdminBetaSubscriber,
  search: string,
) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return 0;
  }

  const textQuery = normalizeSearchText(query);
  const digitQuery = phoneSearchDigits(query);
  const scores = [
    textMatchScore(subscriber.fullName, textQuery),
    textMatchScore(subscriber.firstName, textQuery),
    textMatchScore(subscriber.lastName, textQuery),
    textMatchScore(subscriber.email, textQuery),
  ].filter((score): score is number => score !== null);

  if (digitQuery) {
    const phoneScores = [
      phoneDigitsMatchScore(phoneSearchDigits(subscriber.phoneE164), digitQuery),
      phoneDigitsMatchScore(phoneSearchDigits(subscriber.phoneRaw), digitQuery),
    ].filter((score): score is number => score !== null);

    scores.push(...phoneScores);

    if (subscriber.signupOrderNumber) {
      const signupOrder = String(subscriber.signupOrderNumber);

      if (signupOrder === digitQuery) {
        scores.push(90);
      } else if (signupOrder.startsWith(digitQuery)) {
        scores.push(55);
      }
    }
  }

  return scores.length ? Math.max(...scores) : null;
}

async function getAdminBetaSubscriberCollection(input?: {
  priorityFilter?: AdminSubscriberPriorityFilter;
  search?: string;
  sort?: AdminSubscriberSort;
}): Promise<AdminSubscriberCollectionResult> {
  const priorityLimit = getPriorityBetaLimit();
  const rawApplications = await scanBetaApplications();
  const applications = deriveEffectiveBetaApplications(rawApplications);
  const rawById = new Map(
    rawApplications.map((application) => [application.id, application]),
  );
  const backfillNeeded = applications.some(
    (application) => {
      const raw = rawById.get(application.id);

      return (
        !raw?.signup_order_number ||
        raw.priority_beta === undefined ||
        !raw.subscriber_admin_version
      );
    },
  );
  const { emailById, smsById } = await joinSubscriberRecords(applications);
  const profiles = applications.map((application) =>
    subscriberProfileFromRecords({
      application,
      emailSubscriber: emailById.get(stableId("email", application.normalized_email)),
      priorityLimit,
      smsSubscriber: application.phone_e164
        ? smsById.get(stableId("sms", application.phone_e164))
        : undefined,
    }),
  );
  const priorityFilter = input?.priorityFilter || "all";
  const filteredProfiles = profiles
    .filter((profile) =>
      priorityFilter === "priority"
        ? profile.priorityBeta
        : priorityFilter === "standard"
          ? !profile.priorityBeta
          : true,
    );
  const search = input?.search || "";
  const matches = filteredProfiles
    .map((subscriber): SubscriberSearchMatch | null => {
      const score = subscriberSearchScore(subscriber, search);

      return score === null ? null : { score, subscriber };
    })
    .filter((match): match is SubscriberSearchMatch => Boolean(match));
  const sort = input?.sort || "signup_order_asc";
  const sorted = search.trim()
    ? matches
        .sort(
          (a, b) =>
            b.score - a.score || compareSubscribers(a.subscriber, b.subscriber, sort),
        )
        .map((match) => match.subscriber)
    : sortSubscribers(
        matches.map((match) => match.subscriber),
        sort,
      );

  return {
    backfillNeeded,
    items: sorted,
    priorityCount: profiles.filter((profile) => profile.priorityBeta).length,
    priorityLimit,
    totalCount: sorted.length,
  };
}

export async function listAdminBetaSubscribers(input?: {
  page?: number;
  pageSize?: number;
  priorityFilter?: AdminSubscriberPriorityFilter;
  search?: string;
  sort?: AdminSubscriberSort;
}): Promise<AdminSubscriberListResult> {
  const collection = await getAdminBetaSubscriberCollection({
    priorityFilter: input?.priorityFilter,
    search: input?.search,
    sort: input?.sort,
  });
  const pageSize = Math.max(
    5,
    Math.min(input?.pageSize || DEFAULT_ADMIN_SUBSCRIBER_PAGE_SIZE, 100),
  );
  const totalPages = Math.max(1, Math.ceil(collection.items.length / pageSize));
  const page = Math.max(1, Math.min(input?.page || 1, totalPages));
  const startIndex = (page - 1) * pageSize;

  return {
    backfillNeeded: collection.backfillNeeded,
    items: collection.items.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    priorityCount: collection.priorityCount,
    priorityLimit: collection.priorityLimit,
    totalCount: collection.totalCount,
    totalPages,
  };
}

export async function listAdminBetaSubscribersForExport(input?: {
  priorityFilter?: AdminSubscriberPriorityFilter;
  search?: string;
  sort?: AdminSubscriberSort;
}) {
  return getAdminBetaSubscriberCollection(input);
}

export async function getAdminBetaSubscriber(id: string) {
  const application = await getEffectiveBetaApplicationById(id);

  if (!application) {
    return null;
  }

  const { emailById, smsById } = await joinSubscriberRecords([application]);

  return subscriberProfileFromRecords({
    application,
    emailSubscriber: emailById.get(stableId("email", application.normalized_email)),
    priorityLimit: getPriorityBetaLimit(),
    smsSubscriber: application.phone_e164
      ? smsById.get(stableId("sms", application.phone_e164))
      : undefined,
  });
}

async function countPrioritySubscribers(exceptId?: string) {
  const applications = await scanEffectiveBetaApplications();

  return applications.filter(
    (application) => application.priority_beta && application.id !== exceptId,
  ).length;
}

export async function updateBetaSubscriberNotes(input: {
  adminIdentifier: string;
  expectedVersion: number;
  id: string;
  notes: string;
  now?: string;
}) {
  const now = input.now || new Date().toISOString();
  const nextVersion = input.expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: input.id },
    operation: "update_beta_subscriber_notes",
    returnValues: "ALL_NEW",
    set: {
      admin_notes: input.notes,
      admin_notes_updated_at: now,
      admin_notes_updated_by: input.adminIdentifier,
      subscriber_admin_version: nextVersion,
      updated_at: now,
    },
    conditionExpression:
      "attribute_exists(#id) AND (attribute_not_exists(#version) OR #version = :expectedVersion)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "subscriber_admin_version",
    },
    conditionAttributeValues: {
      ":expectedVersion": input.expectedVersion,
    },
  });

  if (!result.wrote) {
    return null;
  }

  return getAdminBetaSubscriber(input.id);
}

async function setBetaSubscriberPriorityFlag(input: {
  adminIdentifier: string;
  expectedVersion?: number;
  id: string;
  priority: boolean;
  removedReason?: "admin" | "unsubscribe" | null;
  now: string;
}) {
  const current = await getEffectiveBetaApplicationById(input.id);

  if (!current) {
    return null;
  }

  const expectedVersion =
    input.expectedVersion || current.subscriber_admin_version || 1;
  const nextVersion = expectedVersion + 1;
  const result = await updateDynamoItem({
    tableEnvName: DYNAMO_TABLE_ENVS.betaApplications,
    key: { id: input.id },
    operation: "set_beta_subscriber_priority",
    returnValues: "ALL_NEW",
    set: {
      priority_beta: input.priority,
      priority_beta_assigned_at: input.priority ? input.now : null,
      priority_beta_removed_at: input.priority ? null : input.now,
      priority_beta_removed_reason: input.priority
        ? null
        : input.removedReason || "admin",
      priority_beta_updated_at: input.now,
      priority_beta_updated_by: input.adminIdentifier,
      subscriber_admin_version: nextVersion,
      updated_at: input.now,
    },
    conditionExpression:
      "attribute_exists(#id) AND (attribute_not_exists(#version) OR #version = :expectedVersion)",
    conditionAttributeNames: {
      "#id": "id",
      "#version": "subscriber_admin_version",
    },
    conditionAttributeValues: {
      ":expectedVersion": expectedVersion,
    },
  });

  return result.wrote ? getEffectiveBetaApplicationById(input.id) : null;
}

export async function setAdminBetaSubscriberPriority(input: {
  adminIdentifier: string;
  expectedVersion: number;
  id: string;
  priority: boolean;
  replacementSubscriberId?: string;
}) {
  const now = new Date().toISOString();
  const current = await getEffectiveBetaApplicationById(input.id);

  if (!current) {
    return { status: "not_found" as const, subscriber: null };
  }

  if (input.priority && current.priority_beta) {
    return {
      status: "unchanged" as const,
      subscriber: await getAdminBetaSubscriber(input.id),
    };
  }

  if (!input.priority && !current.priority_beta) {
    return {
      status: "unchanged" as const,
      subscriber: await getAdminBetaSubscriber(input.id),
    };
  }

  const priorityLimit = getPriorityBetaLimit();

  if (input.priority) {
    const priorityCount = await countPrioritySubscribers(input.id);

    if (priorityCount >= priorityLimit) {
      if (!input.replacementSubscriberId) {
        return { status: "priority_full" as const, subscriber: null };
      }

      const replacement = await getEffectiveBetaApplicationById(
        input.replacementSubscriberId,
      );

      if (!replacement?.priority_beta) {
        return { status: "replacement_invalid" as const, subscriber: null };
      }

      const demoted = await setBetaSubscriberPriorityFlag({
        adminIdentifier: input.adminIdentifier,
        id: replacement.id,
        priority: false,
        removedReason: "admin",
        now,
      });

      if (!demoted) {
        return { status: "conflict" as const, subscriber: null };
      }
    }

    const promoted = await setBetaSubscriberPriorityFlag({
      adminIdentifier: input.adminIdentifier,
      expectedVersion: input.expectedVersion,
      id: input.id,
      priority: true,
      now,
    });

    return promoted
      ? {
          status: "updated" as const,
          subscriber: await getAdminBetaSubscriber(input.id),
        }
      : { status: "conflict" as const, subscriber: null };
  }

  const demoted = await setBetaSubscriberPriorityFlag({
    adminIdentifier: input.adminIdentifier,
    expectedVersion: input.expectedVersion,
    id: input.id,
    priority: false,
    removedReason: "admin",
    now,
  });

  if (!demoted) {
    return { status: "conflict" as const, subscriber: null };
  }

  if (input.replacementSubscriberId) {
    const replacement = await getEffectiveBetaApplicationById(
      input.replacementSubscriberId,
    );

    if (replacement && !replacement.priority_beta) {
      await setBetaSubscriberPriorityFlag({
        adminIdentifier: input.adminIdentifier,
        id: replacement.id,
        priority: true,
        now,
      });
    }
  }

  return {
    status: "updated" as const,
    subscriber: await getAdminBetaSubscriber(input.id),
  };
}

export async function markBetaSubscriberPriorityRemovedByEmail(input: {
  normalizedEmail: string;
  now: string;
}) {
  const id = stableId("beta", input.normalizedEmail);
  const application = await getEffectiveBetaApplicationById(id);

  if (!application?.priority_beta) {
    return;
  }

  await setBetaSubscriberPriorityFlag({
    adminIdentifier: "system:unsubscribe",
    id,
    priority: false,
    removedReason: "unsubscribe",
    now: input.now,
  });
}

export async function maybeRestoreBetaSubscriberPriorityByEmail(input: {
  normalizedEmail: string;
  now: string;
}) {
  const id = stableId("beta", input.normalizedEmail);
  const application = await getEffectiveBetaApplicationById(id);

  if (
    !application ||
    application.priority_beta ||
    application.priority_beta_removed_reason !== "unsubscribe"
  ) {
    return;
  }

  const priorityCount = await countPrioritySubscribers(application.id);

  if (priorityCount >= getPriorityBetaLimit()) {
    return;
  }

  await setBetaSubscriberPriorityFlag({
    adminIdentifier: "system:resubscribe",
    id,
    priority: true,
    now: input.now,
  });
}

export async function markBetaSubscriberPriorityRemovedByPhone(input: {
  phoneE164: string;
  now: string;
}) {
  const applications = await scanEffectiveBetaApplications();
  const application = applications.find(
    (candidate) => candidate.phone_e164 === input.phoneE164,
  );

  if (!application?.priority_beta) {
    return;
  }

  await setBetaSubscriberPriorityFlag({
    adminIdentifier: "system:sms_opt_out",
    id: application.id,
    priority: false,
    removedReason: "unsubscribe",
    now: input.now,
  });
}

export async function maybeRestoreBetaSubscriberPriorityByPhone(input: {
  phoneE164: string;
  now: string;
}) {
  const applications = await scanEffectiveBetaApplications();
  const application = applications.find(
    (candidate) => candidate.phone_e164 === input.phoneE164,
  );

  if (
    !application ||
    application.priority_beta ||
    application.priority_beta_removed_reason !== "unsubscribe"
  ) {
    return;
  }

  const priorityCount = await countPrioritySubscribers(application.id);

  if (priorityCount >= getPriorityBetaLimit()) {
    return;
  }

  await setBetaSubscriberPriorityFlag({
    adminIdentifier: "system:sms_start",
    id: application.id,
    priority: true,
    now: input.now,
  });
}

export async function getBetaAudienceMembership(
  segment: BetaAudienceSegment,
  input?: { customSubscriberIds?: string[] },
) {
  if (segment === "all") {
    return null;
  }

  const applications = await scanEffectiveBetaApplications();
  const customIds = new Set(input?.customSubscriberIds || []);
  const filtered = applications.filter((application) =>
    segment === "custom"
      ? customIds.has(application.id)
      : segment === "priority"
      ? application.priority_beta
      : !application.priority_beta,
  );

  return {
    applicationIds: new Set(filtered.map((application) => application.id)),
    emails: new Set(
      filtered.map((application) => application.normalized_email).filter(Boolean),
    ),
    phones: new Set(
      filtered.map((application) => application.phone_e164).filter(Boolean),
    ),
  };
}

export function betaSignupPriorityFieldsForOrder(input: {
  now: string;
  signupOrderNumber: number;
}) {
  const priority = shouldAutoAssignPriority(input.signupOrderNumber);

  return {
    priority_beta: priority,
    priority_beta_assigned_at: priority ? input.now : null,
    priority_beta_removed_at: priority ? null : null,
    priority_beta_removed_reason: priority ? null : null,
    priority_beta_updated_at: input.now,
    priority_beta_updated_by: "system:signup",
    signup_order_number: input.signupOrderNumber,
  };
}
