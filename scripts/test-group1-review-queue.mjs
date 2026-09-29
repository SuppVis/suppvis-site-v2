import assert from 'node:assert/strict';
import { isActionableReview, nextPendingTask, upcomingPendingTasks } from '../app/admin/catalog/group1-review-queue.ts';

const tasks = [
  { id: 'a', status: 'pending' },
  { id: 'b', status: 'accepted' },
  { id: 'c', status: 'pending' },
  { id: 'd', status: 'pending' },
  { id: 'e', status: 'pending' },
];
const skipped = new Set(['c']);
assert.equal(nextPendingTask(tasks, '', skipped)?.id, 'a');
assert.equal(nextPendingTask(tasks, 'a', skipped)?.id, 'd');
assert.equal(nextPendingTask(tasks, 'e', skipped), undefined, 'never wrap into an assigned earlier range');
assert.equal(nextPendingTask(tasks, '', skipped, 2, 3)?.id, 'd', 'obey assigned start and end');
assert.equal(nextPendingTask(tasks, 'd', skipped, 2, 3), undefined, 'stop at the assigned end');
assert.deepEqual(upcomingPendingTasks(tasks, 'a', skipped, 0, 4).map((task) => task.id), ['d', 'e']);
assert.deepEqual(upcomingPendingTasks(tasks, 'a', skipped, 0, 3).map((task) => task.id), ['d']);
assert.equal(nextPendingTask(tasks, '', new Set(), 2, 3)?.id, 'c', 'revisiting skipped items restores them');
const rechecks = [
  { id: 'old', status: 'accepted', needsRecheck: true },
  { id: 'new', status: 'pending', needsRecheck: false },
  { id: 'escalated', status: 'escalated', needsRecheck: true },
  { id: 'done', status: 'accepted', needsRecheck: false },
];
assert.equal(isActionableReview(rechecks[0]), true);
assert.equal(isActionableReview(rechecks[2]), false, 'escalation needs a different admin');
assert.deepEqual(upcomingPendingTasks(rechecks, '', new Set(), 0, 3).map((task) => task.id), ['old', 'new']);
assert.equal(nextPendingTask(rechecks, 'old', new Set())?.id, 'new');
assert.equal(nextPendingTask(rechecks, '', new Set(['old']))?.id, 'new');
console.log('Group 1 range and queue tests passed.');
