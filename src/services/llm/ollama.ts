import { LLMProvider } from './types';

export class OllamaProvider implements LLMProvider {
  private async getModelInfo(): Promise<{ model: string, endpoint: string, contextLength: number }> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const res = await chrome.storage.local.get(['ollama_model', 'ollama_endpoint', 'ollama_context_length']);
      return {
        model: res.ollama_model || 'llama3.2:3b',
        endpoint: res.ollama_endpoint || 'http://localhost:11434',
        contextLength: res.ollama_context_length || 4096
      };
    }
    return { model: 'llama3.2:3b', endpoint: 'http://localhost:11434', contextLength: 4096 };
  }

  async generateStream(prompt: string, context: string, onChunk: (chunk: string) => void, _onProgress?: (progress: number, text: string) => void): Promise<string> {
    const combinedPrompt = `System: You are an AI assistant. Provide well-formatted answers: differentiate paragraphs with line breaks, use bold text for topics and key terms, and add numbered lists when appropriate. Do not babble.
      Context:
      ${context}

      Task:
      ${prompt}
      `;
    return new Promise(async (resolve, reject) => {
      const { model, endpoint, contextLength } = await this.getModelInfo();
      
      let port: chrome.runtime.Port;
      try {
        port = chrome.runtime.connect({ name: 'ollama-stream' });
      } catch (err: any) {
        if (err.message && err.message.includes('Extension context invalidated')) {
           return reject(new Error('Extension context invalidated. Please refresh the page to use Ollamatch.'));
        }
        return reject(err);
      }
      
      port.postMessage({
        action: 'generateStream',
        model,
        endpoint,
        contextLength,
        prompt: combinedPrompt
      });

      let completeResponse = '';

      port.onMessage.addListener((msg) => {
        if (msg.error) {
          port.disconnect();
          reject(new Error(msg.error));
        } else if (msg.done) {
          port.disconnect();
          resolve(completeResponse);
        } else if (msg.chunk) {
          completeResponse += msg.chunk;
          onChunk(msg.chunk);
        }
      });

      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
      });
    });
  }

  private async _sendCompletionRequest(prompt: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const { model, endpoint } = await this.getModelInfo();
        chrome.runtime.sendMessage(
          {
            action: 'generateCompletion',
            model,
            endpoint,
            prompt
          },
          (response) => {
            if (chrome.runtime.lastError) {
               return reject(chrome.runtime.lastError.message);
            }
            if (response && response.error) {
              return reject(new Error(response.error));
            }
            if (response && response.result) {
              resolve(response.result.trim());
            } else {
              reject(new Error("Unexpected response from background"));
            }
          }
        );
      } catch (err: any) {
        if (err.message && err.message.includes('Extension context invalidated')) {
           reject(new Error('Extension context invalidated. Please refresh the page to use Ollamatch.'));
        } else {
           reject(err);
        }
      }
    });
  }

  async generateCompletion(prompt: string, context: string = ''): Promise<string> {
    const combinedPrompt = `System: You are a helpful AI assistant. Provide well-formatted answers: differentiate paragraphs with line breaks, use bold text for topics and key terms, and add numbered lists when appropriate. Do not babble.
${context ? `\nContext:\n${context}` : ''}

User Task:
${prompt}
`;
    return this._sendCompletionRequest(combinedPrompt);
  }
}
