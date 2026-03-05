import { useState, useCallback, useEffect } from 'react';
import { llmFactory, ProviderType } from '../services/llm';
import { getPageContext } from '../services/pageScraper';

export const useLLM = () => {
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{progress: number, text: string} | null>(null);
  const [activeProviderName, setActiveProviderName] = useState<ProviderType>('webllm');

  const preloadEngine = useCallback(async (provider: ProviderType) => {
    try {
      const llm = await llmFactory.getProvider(provider);
      if (llm.preload) {
        await llm.preload((progress, text) => {
          setDownloadProgress({ progress, text });
        });
        setDownloadProgress(null);
      }
    } catch (e) {
      console.error('Preload failed', e);
      setDownloadProgress(null);
    }
  }, []);

  useEffect(() => {
    // Just grab the current active provider on mount so UI knows what to show
    const getProviderName = async () => {
      let active: ProviderType = 'webllm';
      if (typeof chrome !== 'undefined' && chrome.storage) {
         const res = await chrome.storage.local.get(['llm_provider']);
         if (res.llm_provider && res.llm_provider !== 'chrome') {
           active = res.llm_provider as ProviderType;
         }
      } else {
        active = llmFactory.getActiveProviderType();
      }
      setActiveProviderName(active);
      if (active === 'webllm') {
        preloadEngine('webllm');
      }
    };
    getProviderName();
  }, [preloadEngine]);

  const generate = useCallback(async (prompt: string, extraContext: string = '', provider?: ProviderType) => {
    setIsGenerating(true);
    setOutput('');
    setError(null);
    setDownloadProgress(null);
    
    try {
      const context = getPageContext() + '\n' + extraContext;
      const llm = await llmFactory.getProvider(provider);
      
      // Update UI with the resolved provider
      if (provider) {
        setActiveProviderName(provider);
      }
      
      await llm.generateStream(
        prompt, 
        context, 
        (chunk) => {
          setOutput((prev) => prev + chunk);
        },
        (progress, text) => {
          setDownloadProgress({ progress, text });
        }
      );
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsGenerating(false);
      setDownloadProgress(null);
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

  return { output, isGenerating, error, generate, autocomplete, setOutput, downloadProgress, activeProviderName, preloadEngine };
};
