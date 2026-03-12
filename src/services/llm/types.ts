export interface LLMProvider {
  /**
   * Generates text based on prompt and context, streaming the response.
   */
  generateStream(
    prompt: string,
    context: string,
    onChunk: (chunk: string) => void,
    onProgress?: (progress: number, text: string) => void
  ): Promise<string>;
  
  /**
   * Generates a single completion (non-streaming)
   */
  generateCompletion(
    prefix: string,
    context: string
  ): Promise<string>;

  /**
   * Preloads the model into memory/storage if necessary.
   */
  preload?(onProgress?: (progress: number, text: string) => void): Promise<void>;
}
