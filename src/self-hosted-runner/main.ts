/**
 * Self-Hosted Runner — headless runner targeting SelfHostedRunnerWorkerService.
 *
 * Entry point for `claude self-hosted-runner` CLI command.
 * This is a stub implementation that provides graceful degradation.
 *
 * Full implementation would:
 * 1. Register with the SelfHostedRunnerWorkerService API
 * 2. Poll for work items (poll IS heartbeat)
 * 3. Execute tasks and report results
 */

export async function selfHostedRunnerMain(args: string[]): Promise<void> {
  console.error(
    'Self-Hosted Runner is not fully configured in this build.\n' +
    'This is a stub implementation.',
  )
  // eslint-disable-next-line n/no-process-exit
  process.exit(1)
}
