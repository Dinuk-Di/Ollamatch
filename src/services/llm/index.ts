import { LLMProvider } from './types';
import { ChromeAIProvider } from './chromeAI';
import { WebLLMProvider } from './webLLM';
import { OllamaProvider } from './ollama';

export type ProviderType = 'chrome' | 'webllm' | 'ollama';

class LLMFactory {
  private activeProvider: ProviderType = 'chrome';
  private instances: Partial<Record<ProviderType, LLMProvider>> = {};

  async getProvider(type?: ProviderType): Promise<LLMProvider> {
    let selected = type || this.activeProvider;
    
    // Attempt to read from storage if not explicitly provided
    if (!type && typeof chrome !== 'undefined' && chrome.storage) {
      const res = await chrome.storage.local.get(['llm_provider']);
      if (res.llm_provider) {
        selected = res.llm_provider as ProviderType;
      }
    }
    
    if (!this.instances[selected]) {
      switch (selected) {
        case 'chrome':
          this.instances.chrome = new ChromeAIProvider();
          break;
        case 'webllm':
          this.instances.webllm = new WebLLMProvider();
          break;
        case 'ollama':
          this.instances.ollama = new OllamaProvider();
          break;
      }
    }
    
    return this.instances[selected]!;
  }

  setProviderType(type: ProviderType) {
    this.activeProvider = type;
  }
  
  getActiveProviderType(): ProviderType {
    return this.activeProvider;
  }
}

export const llmFactory = new LLMFactory();
