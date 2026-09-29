import type { ReviewTask } from "./group1-review-api";

export function isActionableReview(task: ReviewTask): boolean {
  return task.status === "pending" || (task.needsRecheck && task.status !== "escalated");
}

/** The review batch is already ordered by proposed field, then printed name. */
export function nextPendingTask(tasks: ReviewTask[], afterId: string, skipped: ReadonlySet<string>,
  first = 0, last = tasks.length - 1): ReviewTask | undefined {
  const previous = tasks.findIndex((task) => task.id === afterId);
  const start = previous < 0 ? first : Math.max(first, previous + 1);
  for (let index = start; index <= Math.min(last, tasks.length - 1); index += 1) {
    const task = tasks[index];
    if (isActionableReview(task) && !skipped.has(task.id)) return task;
  }
  return undefined;
}

export function upcomingPendingTasks(tasks: ReviewTask[], afterId: string, skipped: ReadonlySet<string>,
  first = 0, last = tasks.length - 1, limit = 2): ReviewTask[] {
  const found: ReviewTask[] = [];
  const previous = tasks.findIndex((task) => task.id === afterId);
  const start = previous < 0 ? first : Math.max(first, previous + 1);
  for (let index = start; index <= Math.min(last, tasks.length - 1) && found.length < limit; index += 1) {
    const task = tasks[index];
    if (isActionableReview(task) && !skipped.has(task.id)) found.push(task);
  }
  return found;
}
