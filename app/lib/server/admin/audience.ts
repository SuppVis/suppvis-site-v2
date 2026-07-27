import {
  DYNAMO_TABLE_ENVS,
  describeDynamoTable,
  getAwsRegion,
  getConfiguredTableName,
} from "@/app/lib/server/dynamo";
import {
  buildCampaignAudience,
  type CampaignAudience,
} from "@/app/lib/server/email/campaign-audience";
import {
  buildSmsCampaignAudience,
  type SmsCampaignAudience,
} from "@/app/lib/server/sms/campaign-audience";
import { PersistenceError } from "@/app/lib/server/errors";
import type { AudienceChannelStatus } from "@/app/lib/server/persistence";

export type AudienceRefreshResult = "success" | "partial" | "failed";

export type AudienceChannelSnapshot = {
  duplicateCount: number;
  eligibleCount: number;
  errorCode: string | null;
  excludedCount: number;
  exclusionGroups: Record<string, number>;
  indexName: string;
  status: AudienceChannelStatus;
  statusGroups: Record<string, number>;
  tableName: string | null;
  totalCount: number;
};

export type AudienceSnapshot = {
  countedAt: string;
  email: AudienceChannelSnapshot;
  refreshResult: AudienceRefreshResult;
  sms: AudienceChannelSnapshot;
};

export const AUDIENCE_STATUS_INDEX_NAME = "status-updated_at-index";

function statusGroups(
  candidates: Array<{ subscriber: { status?: string } }>,
) {
  return candidates.reduce<Record<string, number>>((groups, candidate) => {
    const status = candidate.subscriber.status || "unknown";
    groups[status] = (groups[status] || 0) + 1;
    return groups;
  }, {});
}

function exclusionGroups(
  candidates: Array<{
    decision: { eligible: true } | { eligible: false; reason: string };
  }>,
) {
  return candidates.reduce<Record<string, number>>((groups, candidate) => {
    if (candidate.decision.eligible) {
      return groups;
    }

    groups[candidate.decision.reason] =
      (groups[candidate.decision.reason] || 0) + 1;
    return groups;
  }, {});
}

export function confirmationPhraseForCounts(emailCount: number, smsCount: number) {
  if (emailCount > 0 && smsCount > 0) {
    return `SEND EMAIL TO ${emailCount} AND TEXT TO ${smsCount}`;
  }

  if (emailCount > 0) {
    return `SEND EMAIL TO ${emailCount}`;
  }

  if (smsCount > 0) {
    return `SEND TEXT TO ${smsCount}`;
  }

  return "";
}

export function audienceErrorCode(error: unknown) {
  if (error instanceof PersistenceError) {
    const causeMessage = error.causeMessage || "";

    if (error.code === "dynamodb_batch_get_failed") {
      return error.causeName === "AccessDeniedException"
        ? "audience_base_table_access_denied"
        : "audience_base_table_read_failed";
    }

    if (error.causeName === "AccessDeniedException") {
      return "audience_query_access_denied";
    }

    if (error.causeName === "ResourceNotFoundException") {
      return "audience_resource_not_found";
    }

    if (error.causeName === "ValidationException") {
      if (/specified index/i.test(causeMessage)) {
        return "audience_index_not_found";
      }

      if (/key schema element|key condition/i.test(causeMessage)) {
        return "audience_index_key_mismatch";
      }

      if (/project|projection/i.test(causeMessage)) {
        return "audience_index_projection_insufficient";
      }

      return "audience_index_query_invalid";
    }

    if (error.code === "dynamodb_query_failed") {
      return "audience_query_failed";
    }
  }

  return "audience_refresh_failed";
}

function failedChannel(
  channel: "email" | "sms",
  errorCode: string,
): AudienceChannelSnapshot {
  return {
    duplicateCount: 0,
    eligibleCount: 0,
    errorCode,
    excludedCount: 0,
    exclusionGroups: {},
    indexName: AUDIENCE_STATUS_INDEX_NAME,
    status: "failed",
    statusGroups: {},
    tableName: getConfiguredTableName(
      channel === "email"
        ? DYNAMO_TABLE_ENVS.emailSubscribers
        : DYNAMO_TABLE_ENVS.smsSubscribers,
    ),
    totalCount: 0,
  };
}

function emailChannel(audience: CampaignAudience): AudienceChannelSnapshot {
  return {
    duplicateCount: audience.duplicateCount,
    eligibleCount: audience.eligibleCount,
    errorCode: null,
    excludedCount: audience.excludedCount,
    exclusionGroups: exclusionGroups(audience.candidates),
    indexName: AUDIENCE_STATUS_INDEX_NAME,
    status: "success",
    statusGroups: statusGroups(audience.candidates),
    tableName: getConfiguredTableName(DYNAMO_TABLE_ENVS.emailSubscribers),
    totalCount: audience.totalCount,
  };
}

function smsChannel(audience: SmsCampaignAudience): AudienceChannelSnapshot {
  return {
    duplicateCount: audience.duplicateCount,
    eligibleCount: audience.eligibleCount,
    errorCode: null,
    excludedCount: audience.excludedCount,
    exclusionGroups: exclusionGroups(audience.candidates),
    indexName: AUDIENCE_STATUS_INDEX_NAME,
    status: "success",
    statusGroups: statusGroups(audience.candidates),
    tableName: getConfiguredTableName(DYNAMO_TABLE_ENVS.smsSubscribers),
    totalCount: audience.totalCount,
  };
}

export async function buildAudienceSnapshot() {
  const countedAt = new Date().toISOString();
  const [emailResult, smsResult] = await Promise.allSettled([
    buildCampaignAudience(),
    buildSmsCampaignAudience(),
  ]);

  const email =
    emailResult.status === "fulfilled"
      ? emailChannel(emailResult.value)
      : failedChannel("email", audienceErrorCode(emailResult.reason));
  const sms =
    smsResult.status === "fulfilled"
      ? smsChannel(smsResult.value)
      : failedChannel("sms", audienceErrorCode(smsResult.reason));
  const successCount =
    (email.status === "success" ? 1 : 0) + (sms.status === "success" ? 1 : 0);

  const refreshResult: AudienceRefreshResult =
    successCount === 2 ? "success" : successCount === 1 ? "partial" : "failed";

  return {
    countedAt,
    email,
    refreshResult,
    sms,
  } satisfies AudienceSnapshot;
}

export async function buildAudienceHealth() {
  const checks = await Promise.all(
    [
      {
        channel: "email" as const,
        tableEnvName: DYNAMO_TABLE_ENVS.emailSubscribers,
      },
      {
        channel: "sms" as const,
        tableEnvName: DYNAMO_TABLE_ENVS.smsSubscribers,
      },
    ].map(async (input) => {
      const tableName = getConfiguredTableName(input.tableEnvName);

      if (!tableName) {
        return {
          channel: input.channel,
          gsiStatus: "missing_configuration",
          indexName: AUDIENCE_STATUS_INDEX_NAME,
          region: getAwsRegion(),
          tableName,
          tableStatus: "missing_configuration",
        };
      }

      try {
        const table = await describeDynamoTable({
          tableEnvName: input.tableEnvName,
          operation: `admin_audience_health_${input.channel}`,
        });
        const index = table?.GlobalSecondaryIndexes?.find(
          (candidate) => candidate.IndexName === AUDIENCE_STATUS_INDEX_NAME,
        );

        return {
          channel: input.channel,
          gsiKeySchema:
            index?.KeySchema?.map((key) => ({
              name: key.AttributeName || "unknown",
              type: key.KeyType || "unknown",
            })) || [],
          gsiProjectedAttributes: index?.Projection?.NonKeyAttributes || [],
          gsiProjection: index?.Projection?.ProjectionType || null,
          gsiStatus: index?.IndexStatus || "index_not_found",
          indexName: AUDIENCE_STATUS_INDEX_NAME,
          itemCountEstimate: table?.ItemCount || 0,
          region: getAwsRegion(),
          tableKeySchema:
            table?.KeySchema?.map((key) => ({
              name: key.AttributeName || "unknown",
              type: key.KeyType || "unknown",
            })) || [],
          tableName,
          tableStatus: table?.TableStatus || "unknown",
        };
      } catch (error) {
        return {
          channel: input.channel,
          errorCode: audienceErrorCode(error),
          gsiStatus: "unknown",
          indexName: AUDIENCE_STATUS_INDEX_NAME,
          region: getAwsRegion(),
          tableName,
          tableStatus: "unknown",
        };
      }
    }),
  );

  return {
    checkedAt: new Date().toISOString(),
    checks,
    region: getAwsRegion(),
  };
}
