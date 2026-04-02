let _socketPath = null
export function getDefaultUdsSocketPath() { return null; }
export async function startUdsMessaging(socketPath, options) { _socketPath = socketPath; }
export function setOnEnqueue(callback) {}
export function getUdsMessagingSocketPath() { return _socketPath; }
