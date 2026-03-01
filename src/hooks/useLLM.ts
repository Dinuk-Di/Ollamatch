import { useState, useCallback } from 'react';
import { llmFactory, ProviderType } from '../services/llm';
import { getPageContext } from '../services/pageScraper';

export const useLLM = () => {
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, extraContext: string = '', provider?: ProviderType) => {
    setIsGenerating(true);
    setOutput('');
    setError(null);
    
    try {
      const context = getPageContext() + '\n' + extraContext;
      const llm = await llmFactory.getProvider(provider);
      
      await llm.generateStream(prompt, context, (chunk) => {
        setOutput((prev) => prev + chunk);
      });
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const autocomplete = useCallback(async (prefix: string, provider?: ProviderType) => {
    try {
      const context = getPageContext();
      const llm = await llmFactory.getProvider(provider);
      return await llm.generateCompletion(prefix, context);
    } catch (err: any) {
      console.error('Autocomplete error:', err);
      return null;
    }
  }, []);

  return { output, isGenerating, error, generate, autocomplete, setOutput };
};
