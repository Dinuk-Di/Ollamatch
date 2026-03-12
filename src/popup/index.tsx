import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../content/style.css'; // Reuse Tailwind config
import logoUrl from '../assets/logo.png';

const Popup = () => {
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('llama3.2:3b');
  const [selectedOllamaOcrModel, setSelectedOllamaOcrModel] = useState<string>('llava:latest');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>('http://localhost:11434');
  const [ollamaContextLength, setOllamaContextLength] = useState<number>(4096);
  const [extensionEnabled, setExtensionEnabled] = useState<boolean>(true);

  useEffect(() => {
    chrome.storage.local.get(['ollama_model', 'ollama_ocr_model', 'ollama_endpoint', 'ollama_context_length', 'extension_enabled'], (res) => {
      if (res.extension_enabled !== undefined) {
        setExtensionEnabled(res.extension_enabled);
      } else {
        chrome.storage.local.set({ extension_enabled: true });
      }
      
      if (res.ollama_model) {
        setSelectedOllamaModel(res.ollama_model);
      }
      if (res.ollama_ocr_model) {
        setSelectedOllamaOcrModel(res.ollama_ocr_model);
      } else {
        chrome.storage.local.set({ ollama_ocr_model: 'llava:latest' });
      }
      
      if (res.ollama_endpoint) {
        setOllamaEndpoint(res.ollama_endpoint);
      }
      if (res.ollama_context_length) {
        setOllamaContextLength(res.ollama_context_length);
      } else {
        chrome.storage.local.set({ ollama_context_length: 4096 });
      }
    });
  }, []);

  useEffect(() => {
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
  }, [ollamaEndpoint]);

  const handleOllamaModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOllamaModel(val);
    chrome.storage.local.set({ ollama_model: val });
  };

  const handleOllamaOcrModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOllamaOcrModel(val);
    chrome.storage.local.set({ ollama_ocr_model: val });
  };

  const handleToggleExtension = () => {
    const newVal = !extensionEnabled;
    setExtensionEnabled(newVal);
    chrome.storage.local.set({ extension_enabled: newVal });
  };

  return (
    <div className="w-[380px] p-6 bg-slate-50 font-sans text-gray-800 shadow-2xl">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-3 bg-gradient-to-r from-indigo-600 to-blue-500 -mt-6 -mx-6 p-6 pb-6 shadow-inner text-white rounded-b-2xl">
        <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md shadow-sm border border-white/10 flex items-center justify-center">
           <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain drop-shadow-lg" />
        </div>
        <div className="flex-1">
           <h2 className="text-2xl font-bold tracking-tight leading-tight">Ollamatch</h2>
           <p className="text-sm text-blue-100 font-medium opacity-90 mt-0.5">Engine Configuration</p>
        </div>
        <div className="flex flex-col items-end gap-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-blue-100/80">Extension</label>
            <button 
              onClick={handleToggleExtension}
              className={`w-11 h-6 rounded-full p-1 transition-colors flex items-center ${extensionEnabled ? 'bg-green-400' : 'bg-white/30'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${extensionEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
      </div>
      

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
        <>
          <select 
            value={selectedOllamaModel}
            onChange={handleOllamaModelChange}
            className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500 mb-3"
          >
            {ollamaModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          
          <label className="block text-xs font-semibold mb-1 text-gray-600">Vision/OCR Model</label>
          <select 
            value={selectedOllamaOcrModel}
            onChange={handleOllamaOcrModelChange}
            className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500 text-sm mb-1"
          >
            <option value="llava:latest">llava:latest (default)</option>
            <option value="llava-llama3">llava-llama3</option>
            <option value="moondream">moondream</option>
            {ollamaModels.map(m => (
              <option key={`ocr-${m}`} value={m}>{m}</option>
            ))}
          </select>
        </>
        ) : (
          <div className="text-sm text-red-600 p-2 bg-red-50 rounded border border-red-100">Could not connect to Ollama. Is it running? Make sure to run it with OLLAMA_ORIGINS="*" and your endpoint is correct.</div>
        )}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-1">Context Window Length
          <span className="ml-2 font-normal text-xs text-gray-500">Tokens</span>
        </label>
        <input 
          type="number"
          min="1024"
          max="131072"
          step="1024"
          value={ollamaContextLength}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 4096;
            setOllamaContextLength(val);
            chrome.storage.local.set({ ollama_context_length: val });
          }}
          className="w-full border rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-500 mt-1">Leave at 4096 for typical ~8GB VRAM usage. Raise for longer PDFs/webpages if you have ample VRAM.</p>
      </div>

      <div className="text-sm bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800">
        <h3 className="font-bold mb-1 flex items-center gap-1"><span className="text-base">📌</span> Setup Guide</h3>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li>Requires <a href="https://ollama.com" target="_blank" className="underline font-bold">Ollama</a> installed locally.</li>
          <li>For browser usage, run Ollama with <code className="bg-white/50 px-1 rounded font-mono">OLLAMA_ORIGINS="*"</code> set in your environment variables.</li>
          <li>Wait for the model to load into VRAM on the first request (can take 30-60s on older machines).</li>
        </ul>
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
