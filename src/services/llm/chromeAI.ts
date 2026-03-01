import { LLMProvider } from './types';

export class ChromeAIProvider implements LLMProvider {
  async generateStream(prompt: string, context: string, onChunk: (chunk: string) => void): Promise<string> {
    const ai = (window as any).ai;
    if (!ai || !ai.languageModel) {
      throw new Error('Chrome Built-in AI is not available. Please check chrome://flags.');
    }
    
    const combinedPrompt = `
      Task: ${prompt}
      Background Context: ${context}
      ---
      Respond directly, do not conversationalize.
    `;

    const capabilities = await ai.languageModel.capabilities();
    if (capabilities.available === 'no') {
      throw new Error('Chrome Built-in AI model is not downloaded or available.');
    }

    const session = await ai.languageModel.create();
    const streamInfo = await session.promptStreaming(combinedPrompt);
    
    let previousChunkStr = '';
    let completeResponse = '';

    // The Prompt API returns the accumulated string in each chunk, not just the delta
    for await (const chunk of streamInfo) {
      const delta = chunk.substring(previousChunkStr.length);
      onChunk(delta);
      previousChunkStr = chunk;
      completeResponse = chunk;
    }
    
    session.destroy();
    return completeResponse;
  }

  async generateCompletion(prefix: string, context: string): Promise<string> {
    const ai = (window as any).ai;
    if (!ai || !ai.languageModel) {
      throw new Error('Chrome AI not available.');
    }
    
    const capabilities = await ai.languageModel.capabilities();
    if (capabilities.available === 'no') {
      throw new Error('Model unavailable.');
    }

    const session = await ai.languageModel.create();
    
    const combinedPrompt = `
      Continue writing this text. Only return the continuation, no quotes.
      Context: ${context.substring(0, 1000)}
      Text: "${prefix}"
      Continuation:
    `;

    const response = await session.prompt(combinedPrompt);
    session.destroy();
    
    return response.trim();
  }
}
