import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/server/dynamo.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const module = { exports: {} };
const requireStub = (specifier) => {
  if (specifier === "@aws-sdk/client-dynamodb") {
    return { DynamoDBClient: class DynamoDBClient {} };
  }

  if (specifier === "@aws-sdk/lib-dynamodb") {
    class Command {
      constructor(input) {
        this.input = input;
      }
    }

    return {
      BatchGetCommand: Command,
      DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) },
      GetCommand: Command,
      PutCommand: Command,
      QueryCommand: Command,
      ScanCommand: Command,
      UpdateCommand: Command,
    };
  }

  if (specifier === "./errors") {
    return {
      PersistenceError: class PersistenceError extends Error {},
      ServerConfigError: class ServerConfigError extends Error {},
    };
  }

  throw new Error(`Unexpected test import: ${specifier}`);
};

new Script(compiled, { filename: "dynamo.ts" }).runInNewContext({
  console,
  exports: module.exports,
  module,
  process,
  require: requireStub,
});

const { dedupeDynamoBatchGetKeys } = module.exports;

assert.equal(typeof dedupeDynamoBatchGetKeys, "function");

const normalize = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(
  normalize(dedupeDynamoBatchGetKeys([
    { id: "sms_shared" },
    { id: "sms_shared" },
    { id: "sms_unique" },
  ])),
  [{ id: "sms_shared" }, { id: "sms_unique" }],
  "shared phone-derived SMS keys should be sent to BatchGet only once",
);

assert.deepEqual(
  normalize(dedupeDynamoBatchGetKeys([
    { id: "email_shared" },
    { id: "email_shared" },
    { id: "email_unique" },
  ])),
  [{ id: "email_shared" }, { id: "email_unique" }],
  "shared normalized email-derived keys should be sent to BatchGet only once",
);

assert.deepEqual(
  normalize(dedupeDynamoBatchGetKeys([
    { sort: "a", id: "composite" },
    { id: "composite", sort: "a" },
    { id: "composite", sort: "b" },
  ])),
  [
    { sort: "a", id: "composite" },
    { id: "composite", sort: "b" },
  ],
  "composite keys should de-dupe even when object property order differs",
);

assert.deepEqual(
  normalize(dedupeDynamoBatchGetKeys([
    { id: "same_email_and_phone" },
    { id: "same_email_and_phone" },
    { id: "same_email_and_phone" },
  ])),
  [{ id: "same_email_and_phone" }],
  "mixed duplicate-key batches should preserve a single stable join record",
);

console.log("DynamoDB BatchGet key de-dupe regression checks passed.");
