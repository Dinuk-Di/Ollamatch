import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../content/style.css'; // Reuse Tailwind config
import logoUrl from '../assets/logo.png';
import { useLLM } from '../hooks/useLLM';
import { ProviderType } from '../services/llm';

const Popup = () => {
  const [provider, setProvider] = useState<ProviderType>('webllm');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('llama3.2:3b');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>('http://localhost:11434');
  const { downloadProgress, preloadEngine } = useLLM();

  useEffect(() => {
    chrome.storage.local.get(['llm_provider', 'ollama_model', 'ollama_endpoint'], (res) => {
      if (res.llm_provider && res.llm_provider !== 'chrome') {
        setProvider(res.llm_provider);
      } else if (res.llm_provider === 'chrome') {
        setProvider('webllm');
        chrome.storage.local.set({ llm_provider: 'webllm' });
      }
      if (res.ollama_model) {
        setSelectedOllamaModel(res.ollama_model);
      }
      if (res.ollama_endpoint) {
        setOllamaEndpoint(res.ollama_endpoint);
      }
    });
  }, []);

  useEffect(() => {
    if (provider === 'ollama') {
      fetch(`${ollamaEndpoint.replace(/\/+$/, '')}/api/tags`)
        .then(res => res.json())
        .then(data => {
            const models = data.models?.map((m: any) => m.name) || [];
            setOllamaModels(models);
        })
        .catch(e => {
            console.error("Failed to fetch ollama models", e);
            setOllamaModels([]);
        });
    } else if (provider === 'webllm') {
      preloadEngine('webllm');
    }
  }, [provider, ollamaEndpoint]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as ProviderType;
    setProvider(val);
    chrome.storage.local.set({ llm_provider: val });
    
    // Explicitly trigger a backend preload if they switch to WebLLM so the download starts immediately
    if (val === 'webllm') {
      preloadEngine('webllm');
    }
  };

  const handleOllamaModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOllamaModel(val);
    chrome.storage.local.set({ ollama_model: val });
  };

  return (
    <div className="w-[380px] p-6 bg-slate-50 font-sans text-gray-800 shadow-2xl">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 bg-gradient-to-r from-indigo-600 to-blue-500 -mt-6 -mx-6 p-6 pb-6 shadow-inner text-white rounded-b-2xl">
        <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md shadow-sm border border-white/10 flex items-center justify-center">
           <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain drop-shadow-lg" />
        </div>
        <div>
           <h2 className="text-2xl font-bold tracking-tight leading-tight">BrowserAssist</h2>
           <p className="text-sm text-blue-100 font-medium opacity-90 mt-0.5">Engine Configuration</p>
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-1">AI Provider</label>
        <select 
          value={provider}
          onChange={handleProviderChange}
          className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="webllm">WebLLM (Phi-3) - Offline In-Browser GPU</option>
          <option value="ollama">Local Ollama (Llama-3) - Desktop Native Server</option>
        </select>
      </div>

      {provider === 'ollama' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1">Ollama Endpoint</label>
            <input 
              type="text"
              value={ollamaEndpoint}
              onChange={(e) => {
                const val = e.target.value;
                setOllamaEndpoint(val);
                chrome.storage.local.set({ ollama_endpoint: val });
              }}
              className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="http://localhost:11434"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-1 flex items-center justify-between">
              <span>Ollama Model</span>
              <button onClick={() => {
                fetch(`${ollamaEndpoint.replace(/\/+$/, '')}/api/tags`)
                  .then(res => res.json())
                  .then(data => setOllamaModels(data.models?.map((m: any) => m.name) || []))
                  .catch(() => setOllamaModels([]));
              }} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </label>
          {ollamaModels.length > 0 ? (
            <select 
              value={selectedOllamaModel}
              onChange={handleOllamaModelChange}
              className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ollamaModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-red-600 p-2 bg-red-50 rounded border border-red-100">Could not connect to Ollama. Is it running? Make sure to run it with OLLAMA_ORIGINS="*" and your endpoint is correct.</div>
          )}
        </div>
        </>
      )}

      {provider === 'webllm' && downloadProgress && (
        <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col gap-2">
           <div className="flex justify-between items-center text-xs font-bold text-indigo-700">
              <span>Downloading Model...</span>
              <span>{Math.round(downloadProgress.progress * 100)}%</span>
           </div>
           <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress.progress * 100}%` }}></div>
           </div>
           <p className="text-[10px] text-indigo-500 font-mono truncate">{downloadProgress.text}</p>
        </div>
      )}

      <div className="text-sm bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800">
        <h3 className="font-bold mb-1 flex items-center gap-1"><span className="text-base">📌</span> Setup Guide</h3>
        {provider === 'ollama' && (
          <ul className="list-disc pl-4 space-y-1 text-xs">
            <li>Requires <a href="https://ollama.com" target="_blank" className="underline font-bold">Ollama</a> installed locally.</li>
            <li>Open a terminal / command prompt.</li>
            <li>Run: <code className="bg-white px-1 py-0.5 rounded font-mono break-all font-bold">OLLAMA_ORIGINS="*" ollama serve</code></li>
            <li>This runs the server and explicitly allows the extension to talk to it without getting blocked by CORS.</li>
          </ul>
        )}
        {provider === 'webllm' && (
          <ul className="list-disc pl-4 space-y-1 text-xs">
             <li>Runs Microsoft's Phi-3 entirely offline inside your browser tab using WebGPU.</li>
             <li><b>Warning:</b> First run takes ~2-5 minutes as it securely caches a 1.8GB model to your browser's IndexedDB.</li>
             <li>Subsequent runs will be completely instant.</li>
          </ul>
        )}
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
