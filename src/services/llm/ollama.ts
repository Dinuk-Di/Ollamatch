import { LLMProvider } from './types';

export class OllamaProvider implements LLMProvider {
  private endpoint = 'http://localhost:11434/api/generate';
  private model = 'llama3.2:3b';

  async generateStream(prompt: string, context: string, onChunk: (chunk: string) => void): Promise<string> {
    const combinedPrompt = `System: You are an AI assistant. Do not babble.
Context:
${context}

Task:
${prompt}
`;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: combinedPrompt,
        stream: true
      })
    });

    if (!response.body) throw new Error('No body in response');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let completeResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            completeResponse += parsed.response;
            onChunk(parsed.response);
          }
        } catch (e) {
          console.error("Failed to parse chunk:", line);
        }
      }
    }

    return completeResponse;
  }

  async generateCompletion(prefix: string, context: string): Promise<string> {
    const combinedPrompt = `System: You are an autocomplete engine. Only provide the continuation of the text. Do not repeat the prefix.
Context:
${context}

Prefix:
${prefix}
`;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: combinedPrompt,
        stream: false
      })
    });

    const data = await response.json();
    return data.response.trim();
  }
}
