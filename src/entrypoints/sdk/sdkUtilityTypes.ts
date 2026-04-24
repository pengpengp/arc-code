export type NonNullableUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  server_tool_use?: Array<{
    tool_name: string
    input_tokens: number
  }>
  service_tier?: string
}
