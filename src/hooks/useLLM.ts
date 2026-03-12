import { useState, useCallback } from 'react';
import { llmFactory } from '../services/llm';

// Approx 3.5 chars per token constraint wrapper for safety
const optimizeContext = (context: string, maxTokens: number): string => {
  const maxChars = Math.floor(maxTokens * 3.5);
  if (context.length <= maxChars) return context;
  
  const startTarget = Math.floor(maxChars * 0.25);
  const endTarget = Math.floor(maxChars * 0.75) - 50;
  
  const startText = context.slice(0, startTarget);
  const endText = context.slice(-endTarget);
  
  return `${startText}\n\n... [CONTENT TRUNCATED FOR LENGTH] ...\n\n${endText}`;
};

export const useLLM = () => {
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, extraContext: string = '') => {
    setIsGenerating(true);
    setOutput('');
    setError(null);
    
    try {
      let context = extraContext ? `${extraContext}\n\n` : '';
      
      const llm = await llmFactory.getProvider();
      
      let limit = 4096;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await chrome.storage.local.get(['ollama_context_length']);
        if (res.ollama_context_length) {
          limit = res.ollama_context_length;
        }
      }
      context = optimizeContext(context, limit - 512);
      
      const response = await llm.generateCompletion(prompt, context);
      setOutput(response);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { output, isGenerating, error, generate, setOutput };
};
