import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { PersistenceError, ServerConfigError } from "./errors";

export const DYNAMO_TABLE_ENVS = {
  betaApplications: "DYNAMODB_BETA_APPLICATIONS_TABLE",
  emailSubscribers: "DYNAMODB_EMAIL_SUBSCRIBERS_TABLE",
  emailCampaigns: "DYNAMODB_EMAIL_CAMPAIGNS_TABLE",
  emailCampaignRecipients: "DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE",
  smsSubscribers: "DYNAMODB_SMS_SUBSCRIBERS_TABLE",
  broadcastAuditLogs: "DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE",
} as const;

type DynamoRecord = Record<string, unknown>;

type UpsertInput = {
  tableEnvName: string;
  key: DynamoRecord;
  set: DynamoRecord;
  setIfNotExists?: DynamoRecord;
  conditionAttributeNotExists?: string[];
  returnValues?: "ALL_NEW" | "UPDATED_NEW" | "NONE";
  operation: string;
};

type UpdateInput = {
  tableEnvName: string;
  key: DynamoRecord;
  set: DynamoRecord;
  remove?: string[];
  conditionExpression?: string;
  conditionAttributeNames?: Record<string, string>;
  conditionAttributeValues?: DynamoRecord;
  returnValues?: "ALL_NEW" | "UPDATED_NEW" | "NONE";
  operation: string;
};

type IncrementInput = {
  tableEnvName: string;
  key: DynamoRecord;
  add: Record<string, number>;
  set?: DynamoRecord;
  conditionExpression?: string;
  conditionAttributeNames?: Record<string, string>;
  conditionAttributeValues?: DynamoRecord;
  returnValues?: "ALL_NEW" | "UPDATED_NEW" | "NONE";
  operation: string;
};

type QueryInput = {
  tableEnvName: string;
  indexName?: string;
  keyConditionExpression: string;
  filterExpression?: string;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoRecord;
  exclusiveStartKey?: DynamoRecord;
  limit?: number;
  scanIndexForward?: boolean;
  operation: string;
};

type ScanInput = {
  tableEnvName: string;
  filterExpression?: string;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoRecord;
  exclusiveStartKey?: DynamoRecord;
  limit?: number;
  operation: string;
};

let documentClient: DynamoDBDocumentClient | null = null;

export function getAwsRegion() {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function getDocumentClient() {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: getAwsRegion(),
      }),
      {
        marshallOptions: {
          removeUndefinedValues: true,
        },
      },
    );
  }

  return documentClient;
}

export function getConfiguredTableName(envName: string) {
  return process.env[envName]?.trim() || null;
}

function getRequiredTableName(envName: string) {
  const tableName = getConfiguredTableName(envName);

  if (!tableName) {
    throw new ServerConfigError(`Missing required environment variable: ${envName}`);
  }

  return tableName;
}

export function assertDynamoTablesConfigured(...envNames: string[]) {
  for (const envName of envNames) {
    getRequiredTableName(envName);
  }
}

function dynamoKeyFingerprint(key: DynamoRecord) {
  return JSON.stringify(
    Object.keys(key)
      .sort()
      .map((name) => [name, key[name]]),
  );
}

export function dedupeDynamoBatchGetKeys(keys: DynamoRecord[]) {
  const seen = new Set<string>();
  const uniqueKeys: DynamoRecord[] = [];

  for (const key of keys) {
    const fingerprint = dynamoKeyFingerprint(key);

    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    uniqueKeys.push(key);
  }

  return uniqueKeys;
}

function definedEntries(record: DynamoRecord) {
  return Object.entries(record).filter(([, value]) => value !== undefined);
}

function safeDynamoErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return error.message
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[access_key]")
    .replace(/\bASIA[0-9A-Z]{16}\b/g, "[access_key]")
    .replace(/\bAC[a-fA-F0-9]{32}\b/g, "[account]")
    .replace(/\bMG[a-fA-F0-9]{32}\b/g, "[messaging_service]")
    .replace(/\+\d{8,15}/g, "[phone]")
    .slice(0, 600);
}

function safeExpressionAttributeValuesForLog(
  operation: string,
  values?: DynamoRecord,
) {
  if (!values) {
    return undefined;
  }

  const statusOnlyOperations = new Set([
    "list_email_subscribers_by_status",
    "list_sms_subscribers_for_announcement_by_status",
  ]);

  if (statusOnlyOperations.has(operation)) {
    return values;
  }

  return Object.fromEntries(
    Object.keys(values).map((key) => [key, "[redacted]"]),
  );
}

export async function upsertDynamoItem(input: UpsertInput) {
  const tableName = getRequiredTableName(input.tableEnvName);
  const keyAttributeNames = new Set(Object.keys(input.key));
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};
  const updateParts: string[] = [];
  const conditionParts: string[] = [];
  let index = 0;

  for (const [name, value] of definedEntries(input.set)) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#n${index}`;
    const valueKey = `:v${index}`;
    expressionAttributeNames[nameKey] = name;
    expressionAttributeValues[valueKey] = value;
    updateParts.push(`${nameKey} = ${valueKey}`);
    index += 1;
  }

  for (const [name, value] of definedEntries(input.setIfNotExists || {})) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#n${index}`;
    const valueKey = `:v${index}`;
    expressionAttributeNames[nameKey] = name;
    expressionAttributeValues[valueKey] = value;
    updateParts.push(`${nameKey} = if_not_exists(${nameKey}, ${valueKey})`);
    index += 1;
  }

  for (const name of input.conditionAttributeNotExists || []) {
    const nameKey = `#c${conditionParts.length}`;
    expressionAttributeNames[nameKey] = name;
    conditionParts.push(`attribute_not_exists(${nameKey})`);
  }

  if (!updateParts.length) {
    throw new ServerConfigError(`No attributes configured for ${input.operation}`);
  }

  try {
    const result = await getDocumentClient().send(
      new UpdateCommand({
        TableName: tableName,
        Key: input.key,
        UpdateExpression: `SET ${updateParts.join(", ")}`,
        ConditionExpression: conditionParts.length
          ? conditionParts.join(" AND ")
          : undefined,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: input.returnValues,
      }),
    );

    return {
      wrote: true,
      attributes: result.Attributes as DynamoRecord | undefined,
    };
  } catch (error) {
    if (
      input.conditionAttributeNotExists?.length &&
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return { wrote: false };
    }

    console.error("[dynamodb] upsert failed", {
      operation: input.operation,
      tableEnvName: input.tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    throw new PersistenceError();
  }
}

export async function updateDynamoItem(input: UpdateInput) {
  const tableName = getRequiredTableName(input.tableEnvName);
  const keyAttributeNames = new Set(Object.keys(input.key));
  const expressionAttributeNames: Record<string, string> = {
    ...(input.conditionAttributeNames || {}),
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ...(input.conditionAttributeValues || {}),
  };
  const setParts: string[] = [];
  const removeParts: string[] = [];
  let index = 0;

  for (const [name, value] of definedEntries(input.set)) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#u${index}`;
    const valueKey = `:u${index}`;
    expressionAttributeNames[nameKey] = name;
    expressionAttributeValues[valueKey] = value;
    setParts.push(`${nameKey} = ${valueKey}`);
    index += 1;
  }

  for (const name of input.remove || []) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#r${removeParts.length}`;
    expressionAttributeNames[nameKey] = name;
    removeParts.push(nameKey);
  }

  const updateExpression = [
    setParts.length ? `SET ${setParts.join(", ")}` : "",
    removeParts.length ? `REMOVE ${removeParts.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!updateExpression) {
    throw new ServerConfigError(`No attributes configured for ${input.operation}`);
  }

  try {
    const result = await getDocumentClient().send(
      new UpdateCommand({
        TableName: tableName,
        Key: input.key,
        UpdateExpression: updateExpression,
        ConditionExpression: input.conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: input.returnValues,
      }),
    );

    return {
      wrote: true,
      attributes: result.Attributes as DynamoRecord | undefined,
    };
  } catch (error) {
    if (
      input.conditionExpression &&
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return { wrote: false };
    }

    console.error("[dynamodb] update failed", {
      operation: input.operation,
      tableEnvName: input.tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    throw new PersistenceError();
  }
}

export async function incrementDynamoItem(input: IncrementInput) {
  const tableName = getRequiredTableName(input.tableEnvName);
  const keyAttributeNames = new Set(Object.keys(input.key));
  const expressionAttributeNames: Record<string, string> = {
    ...(input.conditionAttributeNames || {}),
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ...(input.conditionAttributeValues || {}),
  };
  const addParts: string[] = [];
  const setParts: string[] = [];
  let index = 0;

  for (const [name, value] of definedEntries(input.add)) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#a${index}`;
    const valueKey = `:a${index}`;
    expressionAttributeNames[nameKey] = name;
    expressionAttributeValues[valueKey] = value;
    addParts.push(`${nameKey} ${valueKey}`);
    index += 1;
  }

  for (const [name, value] of definedEntries(input.set || {})) {
    if (keyAttributeNames.has(name)) {
      continue;
    }

    const nameKey = `#s${index}`;
    const valueKey = `:s${index}`;
    expressionAttributeNames[nameKey] = name;
    expressionAttributeValues[valueKey] = value;
    setParts.push(`${nameKey} = ${valueKey}`);
    index += 1;
  }

  const updateExpression = [
    addParts.length ? `ADD ${addParts.join(", ")}` : "",
    setParts.length ? `SET ${setParts.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!updateExpression) {
    throw new ServerConfigError(`No attributes configured for ${input.operation}`);
  }

  try {
    const result = await getDocumentClient().send(
      new UpdateCommand({
        TableName: tableName,
        Key: input.key,
        UpdateExpression: updateExpression,
        ConditionExpression: input.conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: input.returnValues,
      }),
    );

    return {
      wrote: true,
      attributes: result.Attributes as DynamoRecord | undefined,
    };
  } catch (error) {
    if (
      input.conditionExpression &&
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return { wrote: false };
    }

    console.error("[dynamodb] increment failed", {
      operation: input.operation,
      tableEnvName: input.tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    throw new PersistenceError();
  }
}

export async function describeDynamoTable(input: {
  tableEnvName: string;
  operation: string;
}) {
  const tableName = getRequiredTableName(input.tableEnvName);

  try {
    const result = await getDocumentClient().send(
      new DescribeTableCommand({
        TableName: tableName,
      }),
    );

    return result.Table || null;
  } catch (error) {
    console.error("[dynamodb] describe table failed", {
      operation: input.operation,
      tableName,
      tableEnvName: input.tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: safeDynamoErrorMessage(error),
    });

    throw new PersistenceError(
      "DynamoDB describe table failed",
      "dynamodb_describe_failed",
      error instanceof Error ? error.name : "UnknownError",
      safeDynamoErrorMessage(error),
    );
  }
}

export async function getDynamoItem(input: {
  tableEnvName: string;
  key: DynamoRecord;
  operation: string;
}) {
  const tableName = getRequiredTableName(input.tableEnvName);

  try {
    const result = await getDocumentClient().send(
      new GetCommand({
        TableName: tableName,
        Key: input.key,
      }),
    );

    return result.Item as DynamoRecord | undefined;
  } catch (error) {
    console.error("[dynamodb] get failed", {
      operation: input.operation,
      tableEnvName: input.tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    throw new PersistenceError(
      "DynamoDB get failed",
      "dynamodb_get_failed",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
}

export async function batchGetDynamoItems(input: {
  tableEnvName: string;
  keys: DynamoRecord[];
  operation: string;
}) {
  const tableName = getRequiredTableName(input.tableEnvName);
  const items: DynamoRecord[] = [];
  const keys = dedupeDynamoBatchGetKeys(input.keys);

  for (let index = 0; index < keys.length; index += 100) {
    let requestKeys = keys.slice(index, index + 100);

    do {
      try {
        const result = await getDocumentClient().send(
          new BatchGetCommand({
            RequestItems: {
              [tableName]: {
                Keys: requestKeys,
              },
            },
          }),
        );

        items.push(
          ...(((result.Responses || {})[tableName] || []) as DynamoRecord[]),
        );

        requestKeys =
          ((result.UnprocessedKeys || {})[tableName]?.Keys as
            | DynamoRecord[]
            | undefined) || [];
      } catch (error) {
        console.error("[dynamodb] batch get failed", {
          operation: input.operation,
          tableName,
          tableEnvName: input.tableEnvName,
          keyCount: requestKeys.length,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: safeDynamoErrorMessage(error),
        });

        throw new PersistenceError(
          "DynamoDB batch get failed",
          "dynamodb_batch_get_failed",
          error instanceof Error ? error.name : "UnknownError",
          safeDynamoErrorMessage(error),
        );
      }
    } while (requestKeys.length);
  }

  return items;
}

export async function queryDynamoItems(input: QueryInput) {
  const result = await queryDynamoItemsPage(input);
  return result.items;
}

export async function queryDynamoItemsPage(input: QueryInput) {
  const tableName = getRequiredTableName(input.tableEnvName);

  try {
    const result = await getDocumentClient().send(
      new QueryCommand({
        TableName: tableName,
        IndexName: input.indexName,
        KeyConditionExpression: input.keyConditionExpression,
        FilterExpression: input.filterExpression,
        ProjectionExpression: input.projectionExpression,
        ExpressionAttributeNames: input.expressionAttributeNames,
        ExpressionAttributeValues: input.expressionAttributeValues,
        ExclusiveStartKey: input.exclusiveStartKey,
        Limit: input.limit,
        ScanIndexForward: input.scanIndexForward,
      }),
    );

    return {
      items: (result.Items || []) as DynamoRecord[],
      lastEvaluatedKey: result.LastEvaluatedKey as DynamoRecord | undefined,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = safeDynamoErrorMessage(error);

    console.error("[dynamodb] query failed", {
      operation: input.operation,
      tableName,
      tableEnvName: input.tableEnvName,
      indexName: input.indexName,
      keyConditionExpression: input.keyConditionExpression,
      filterExpression: input.filterExpression || null,
      projectionExpression: input.projectionExpression || null,
      expressionAttributeNames: input.expressionAttributeNames || null,
      expressionAttributeValues: safeExpressionAttributeValuesForLog(
        input.operation,
        input.expressionAttributeValues,
      ),
      exclusiveStartKeyPresent: Boolean(input.exclusiveStartKey),
      limit: input.limit || null,
      scanIndexForward: input.scanIndexForward ?? null,
      consistentRead: false,
      select: input.projectionExpression
        ? "SPECIFIC_ATTRIBUTES"
        : "ALL_PROJECTED_ATTRIBUTES",
      errorName,
      errorMessage,
    });

    throw new PersistenceError(
      "DynamoDB query failed",
      "dynamodb_query_failed",
      errorName,
      errorMessage,
    );
  }
}

export async function scanDynamoItemsPage(input: ScanInput) {
  const tableName = getRequiredTableName(input.tableEnvName);

  try {
    const result = await getDocumentClient().send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: input.filterExpression,
        ProjectionExpression: input.projectionExpression,
        ExpressionAttributeNames: input.expressionAttributeNames,
        ExpressionAttributeValues: input.expressionAttributeValues,
        ExclusiveStartKey: input.exclusiveStartKey,
        Limit: input.limit,
      }),
    );

    return {
      items: (result.Items || []) as DynamoRecord[],
      lastEvaluatedKey: result.LastEvaluatedKey as DynamoRecord | undefined,
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = safeDynamoErrorMessage(error);

    console.error("[dynamodb] scan failed", {
      operation: input.operation,
      tableName,
      tableEnvName: input.tableEnvName,
      filterExpression: input.filterExpression || null,
      projectionExpression: input.projectionExpression || null,
      expressionAttributeNames: input.expressionAttributeNames || null,
      expressionAttributeValues: safeExpressionAttributeValuesForLog(
        input.operation,
        input.expressionAttributeValues,
      ),
      exclusiveStartKeyPresent: Boolean(input.exclusiveStartKey),
      limit: input.limit || null,
      consistentRead: false,
      errorName,
      errorMessage,
    });

    throw new PersistenceError(
      "DynamoDB scan failed",
      "dynamodb_scan_failed",
      errorName,
      errorMessage,
    );
  }
}

export async function putDynamoItem(
  tableEnvName: string,
  item: DynamoRecord,
  operation: string,
) {
  const tableName = getRequiredTableName(tableEnvName);

  try {
    await getDocumentClient().send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );
  } catch (error) {
    console.error("[dynamodb] put failed", {
      operation,
      tableEnvName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    throw new PersistenceError();
  }
}
