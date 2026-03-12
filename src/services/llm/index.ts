import { OllamaProvider } from './ollama';

export type ProviderType = 'ollama';

export interface LLMProvider {
  generateCompletion(prompt: string, context?: string, model?: string): Promise<string>;
}

class LLMFactory {
  private instances: Partial<Record<ProviderType, LLMProvider>> = {};
  private activeProvider: ProviderType | null = null;

  async getProvider(): Promise<LLMProvider> {
    if (!this.activeProvider) {
      const selected = await new Promise<ProviderType>((resolve) => {
        chrome.storage.local.get(['llm_provider'], (result) => {
          let selected = result.llm_provider as ProviderType;
          if (!selected || selected !== 'ollama') {
             selected = 'ollama';
             chrome.storage.local.set({ llm_provider: 'ollama' });
          }
          resolve(selected);
        });
      });
      
      this.activeProvider = selected;
    }

    const selectedProviderStr = this.activeProvider || 'ollama';

    if (!this.instances[selectedProviderStr]) {
      this.instances.ollama = new OllamaProvider();
    }
    
    return this.instances[selectedProviderStr]!;
  }
}

export const llmFactory = new LLMFactory();
