import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { PersistenceError, ServerConfigError } from "./errors";

export const DYNAMO_TABLE_ENVS = {
  betaApplications: "DYNAMODB_BETA_APPLICATIONS_TABLE",
  emailSubscribers: "DYNAMODB_EMAIL_SUBSCRIBERS_TABLE",
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

let documentClient: DynamoDBDocumentClient | null = null;

function getAwsRegion() {
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

function getRequiredTableName(envName: string) {
  const tableName = process.env[envName]?.trim();

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

function definedEntries(record: DynamoRecord) {
  return Object.entries(record).filter(([, value]) => value !== undefined);
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
