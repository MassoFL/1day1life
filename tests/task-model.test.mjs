import test from "node:test";
import assert from "node:assert/strict";
import { decodeTasks, defaultTasks } from "../lib/task-model.mjs";
test("decodes arrays and legacy JSON strings, rejects malformed API payloads", () => {
  assert.deepEqual(decodeTasks(defaultTasks), defaultTasks);
  assert.deepEqual(decodeTasks(JSON.stringify(defaultTasks)), defaultTasks);
  for (const input of [
    null,
    {},
    { error: "failure" },
    "invalid",
    "{}",
    [{ name: "bad" }],
  ])
    assert.throws(() => decodeTasks(input), /Invalid stored task list/);
});
