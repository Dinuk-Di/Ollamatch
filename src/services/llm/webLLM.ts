import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm';
import { LLMProvider } from './types';

export class WebLLMProvider implements LLMProvider {
  private engine: MLCEngine | null = null;
  private modelName = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';

  async initEngine(onProgress?: (progress: number, text: string) => void) {
    if (this.engine) return;
    this.engine = await CreateMLCEngine(this.modelName, {
      initProgressCallback: (info) => {
        if (onProgress) onProgress(info.progress, info.text);
      }
    });
  }

  async generateStream(prompt: string, context: string, onChunk: (chunk: string) => void): Promise<string> {
    await this.initEngine();
    
    const messages = [
      { role: 'system' as const, content: 'You are an AI assistant. Be direct.' },
      { role: 'user' as const, content: `Context:\n${context}\n\nTask:\n${prompt}` }
    ];

    const asyncChunkGenerator = await this.engine!.chat.completions.create({
      messages,
      stream: true,
      max_tokens: 512,
    });

    let completeResponse = '';
    for await (const chunk of asyncChunkGenerator) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        completeResponse += delta;
        onChunk(delta);
      }
    }
    
    return completeResponse;
  }

  async generateCompletion(prefix: string, context: string): Promise<string> {
    await this.initEngine();

    const messages = [
      { role: 'system' as const, content: 'You are an autocomplete engine. Complete the user\'s partial sentence. ONLY return the continuation part, do not repeat the prefix.' },
      { role: 'user' as const, content: `Context:\n${context}\n\nPrefix text:\n${prefix}` }
    ];

    const res = await this.engine!.chat.completions.create({
      messages,
      max_tokens: 64,
    });

    return res.choices[0]?.message?.content || '';
  }
}
