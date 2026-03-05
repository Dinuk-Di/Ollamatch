import React, { useState, useRef } from 'react';
import { useLLM } from '../hooks/useLLM';
import { Bot, Loader2, Send, FileText, UploadCloud, ChevronDown, ChevronUp } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import logoUrl from '../assets/logo.png';

// To avoid CSP issues with CDNs in Chrome Extensions, we configure PDF.js to use the local worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface AssistantAppProps {
  onAccept: (text: string) => void;
  onCancel: () => void;
}

export const AssistantApp: React.FC<AssistantAppProps> = ({ onAccept, onCancel }) => {
  const [prompt, setPrompt] = useState('');
  const [pdfContext, setPdfContext] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showContext, setShowContext] = useState(false);
  
  const { generate, output, isGenerating, error, downloadProgress, activeProviderName } = useLLM();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    generate(prompt, pdfContext ? `[Attached PDF Document:]\n${pdfContext}` : '');
  };

  const processPDF = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }
    
    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let text = '';
      const maxPages = Math.min(pdf.numPages, 4);
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      
      setPdfContext(text);
      setShowContext(true); // Auto-show context area when uploaded
    } catch (err) {
      console.error('Failed to parse PDF', err);
      alert('Failed to parse PDF');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await processPDF(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processPDF(file);
    }
  };

  return (
    <div 
      className={`fixed top-4 right-4 w-[500px] bg-white/70 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border text-gray-800 font-sans transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${isHovering ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200/50'}`} 
      style={{ zIndex: 999999, maxHeight: '85vh' }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
      onDragLeave={() => setIsHovering(false)}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-4 flex items-center justify-between text-white drop-shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg tracking-wide">
          <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-md shadow-inner flex items-center justify-center">
            <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain drop-shadow" />
          </div>
          <span>BrowserAssist AI</span>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      {/* Dropzone Overlay */}
      {isHovering && (
        <div className="absolute inset-0 top-[72px] bg-indigo-50/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-indigo-600 border-2 border-dashed border-indigo-400 m-4 rounded-xl">
          <UploadCloud size={64} className="mb-4 animate-bounce" />
          <p className="text-xl font-bold">Drop PDF to Attach Context</p>
          <p className="text-sm font-medium opacity-80 mt-2">Max 4 pages parsed</p>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/50">
      
        {/* Provider Hints */}
        {activeProviderName === 'ollama' && !output && !isGenerating && (
          <div className="px-5 py-3 bg-orange-50/80 border-b border-orange-100/50 text-xs text-orange-700 flex items-start gap-2">
            <Bot size={14} className="mt-0.5 shrink-0" />
            <p>Using <b>Local Ollama</b>. Ensure your server is running with <code className="bg-white/50 px-1 rounded font-mono">OLLAMA_ORIGINS="*" ollama serve</code> or you will get CORS errors.</p>
          </div>
        )}
        {activeProviderName === 'webllm' && downloadProgress && (
          <div className="px-5 py-4 bg-indigo-50/80 border-b border-indigo-100 flex flex-col gap-2">
             <div className="flex justify-between items-center text-xs font-bold text-indigo-700">
                <span>Downloading AI Model to VRAM...</span>
                <span>{Math.round(downloadProgress.progress * 100)}%</span>
             </div>
             <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress.progress * 100}%` }}></div>
             </div>
             <p className="text-[10px] text-indigo-500 font-mono truncate">{downloadProgress.text}</p>
          </div>
        )}
        
        {/* Context Accordion */}
        <div className="border-b border-gray-100 bg-white">
          <button 
            onClick={() => setShowContext(!showContext)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-gray-600 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={16} className={pdfContext ? 'text-indigo-500' : 'text-gray-400'} />
              <span>Reference Context {pdfContext && <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">{(pdfContext.length / 1024).toFixed(1)} KB</span>}</span>
            </div>
            {showContext ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showContext && (
            <div className="px-5 pb-4 pt-1 animate-in slide-in-from-top-2 duration-200">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-600 max-h-32 overflow-y-auto relative whitespace-pre-wrap font-mono leading-relaxed">
                {pdfContext ? pdfContext : "No PDF attached. Drag a PDF here or click below to upload."}
              </div>
              
              {!pdfContext && (
                <div className="mt-3">
                  <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                    className="w-full py-2.5 flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-medium hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {isParsing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {isParsing ? 'Parsing Document...' : 'Upload PDF Document'}
                  </button>
                </div>
              )}
              {pdfContext && (
                <div className="mt-2 flex justify-end">
                   <button onClick={() => setPdfContext('')} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1">Clear PDF</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Output Area */}
        {output && (
          <div className="p-5 flex-1 max-h-80 overflow-y-auto bg-white border-b border-gray-100 shadow-inner">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bot size={14} /> Generated Response
            </h3>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">
              {output}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mx-5 my-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 shadow-sm">
            <div className="mt-0.5">⚠️</div>
            <div className="flex-1">
              <p className="font-bold mb-1">Error Generating Response</p>
              <p className="opacity-90 leading-tight">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-5 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
        <div className="relative group">
          <textarea
            autoFocus
            className="w-full resize-none rounded-2xl border-2 border-gray-200 p-4 pr-16 outline-none hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-[15px] h-28 bg-gray-50/50 focus:bg-white transition-all duration-200 shadow-sm"
            placeholder="What should I write? (e.g. Write a polite rejection email)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
          </button>
        </div>

        {output && !isGenerating && (
          <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={() => onAccept(output)}
              className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              Insert Response
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
