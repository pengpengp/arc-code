/**
 * Environment Runner — BYOC (Bring Your Own Cloud) headless runner.
 *
 * Entry point for `claude environment-runner` CLI command.
 * This is a stub implementation that provides graceful degradation.
 *
 * Full implementation would:
 * 1. Connect to the BYOC orchestration API
 * 2. Register as an execution environment
 * 3. Poll for tasks and execute them headlessly
 * 4. Report results back to the coordinator
 */

export async function environmentRunnerMain(args: string[]): Promise<void> {
  console.error(
    'Environment Runner (BYOC) is not fully configured in this build.\n' +
    'This is a stub implementation.',
  )
  // eslint-disable-next-line n/no-process-exit
  process.exit(1)
}
