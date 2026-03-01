export interface LLMProvider {
  /**
   * Generates text based on prompt and context, streaming the response.
   */
  generateStream(
    prompt: string,
    context: string,
    onChunk: (chunk: string) => void
  ): Promise<string>;
  
  /**
   * Generates a single completion (non-streaming, useful for inline autocomplete)
   */
  generateCompletion(
    prefix: string,
    context: string
  ): Promise<string>;
}
