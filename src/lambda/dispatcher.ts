import { runDispatcher, type DispatchSummary } from '@/controller/job-dispatch'

/*
 * Dispatcher Lambda (EventBridge scheduled, every minute).
 *
 * Entry point, like the poll loops in workers/: it wires the runtime to the
 * controller and holds no business logic. It deliberately does NOT call
 * process.exit — the Lambda runtime must flush stdout and report the result.
 */
export const handler = async (): Promise<DispatchSummary> => runDispatcher()
