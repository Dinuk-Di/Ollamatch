import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../content/style.css'; // Reuse Tailwind config

const Popup = () => {
  const [provider, setProvider] = useState<'chrome' | 'webllm' | 'ollama'>('chrome');

  useEffect(() => {
    chrome.storage.local.get(['llm_provider'], (res) => {
      if (res.llm_provider) {
        setProvider(res.llm_provider);
      }
    });
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as any;
    setProvider(val);
    chrome.storage.local.set({ llm_provider: val });
  };

  return (
    <div className="w-80 p-4 bg-white text-gray-800 font-sans">
      <h1 className="text-lg font-bold text-blue-600 mb-4 border-b pb-2">BrowserAssist Settings</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-1">AI Provider</label>
        <select 
          value={provider}
          onChange={handleProviderChange}
          className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="chrome">Chrome Built-in AI (Gemini Nano) - Fastest</option>
          <option value="webllm">WebLLM (Phi-3) - Balanced</option>
          <option value="ollama">Local Ollama (Llama-3) - Powerful</option>
        </select>
        <p className="mt-2 text-xs text-gray-500">
          Note: If Chrome Built-in AI isn't working, make sure you enabled the Prompt API flag in chrome://flags. WebLLM will download the model to VRAM on first run. Ollama requires a local server.
        </p>
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
