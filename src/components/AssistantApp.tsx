import React, { useState, useRef, useEffect } from 'react';
import { useLLM } from '../hooks/useLLM';
import { getPageContext, getPageImageInfos, PageImageInfo } from '../services/pageScraper';
import { Bot, Loader2, Send, UploadCloud, Copy, Check, ImageIcon, Sparkles, X, Gauge, ChevronRight, ChevronLeft, SkipForward, CheckCircle2, Globe, FileUp, Wand2, RefreshCw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface AssistantAppProps {
  onAccept: (text: string) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 0, label: 'Webpage', icon: Globe },
  { id: 1, label: 'Images', icon: ImageIcon },
  { id: 2, label: 'Documents', icon: FileUp },
  { id: 3, label: 'Generate', icon: Wand2 },
];

export const AssistantApp: React.FC<AssistantAppProps> = ({ onAccept, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [pageContext, setPageContext] = useState('');
  
  // Step 2: Images
  const [pageImages, setPageImages] = useState<PageImageInfo[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [ocrContext, setOcrContext] = useState('');
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [hasOcred, setHasOcred] = useState(false);
  
  // Step 3: Documents
  const [pdfContext, setPdfContext] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchSummary, setMatchSummary] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Step 4: Generate
  const [prompt, setPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const { output, isGenerating, error, generate } = useLLM();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageContext(getPageContext());
    const imgs = getPageImageInfos();
    setPageImages(imgs);
  }, []);

  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // ─── Refresh page data ───
  const refreshPageData = () => {
    setPageContext(getPageContext());
    const imgs = getPageImageInfos();
    setPageImages(imgs);
    setSelectedImages(new Set());
    setOcrContext('');
    setHasOcred(false);
    setMatchScore(null);
    setMatchSummary('');
  };

  // ─── Navigation ───
  const goNext = () => {
    if (currentStep === 0 && pageImages.length === 0) {
      // Skip images step if no images found
      setCurrentStep(2);
    } else {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };
  const goBack = () => {
    if (currentStep === 2 && pageImages.length === 0) {
      setCurrentStep(0);
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 0));
    }
  };
  const goToStep = (step: number) => {
    if (step === 1 && pageImages.length === 0) return; // Can't go to images if none
    setCurrentStep(step);
  };

  // ─── OCR ───
  const handleOcr = async () => {
    if (selectedImages.size === 0) return;
    setIsExtractingOcr(true);
    setOcrContext('');

    const selectedSrcs = Array.from(selectedImages).map(i => pageImages[i].src);
    
    // Convert selected images to base64 via background
    const base64Images: string[] = [];
    for (const src of selectedSrcs) {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ action: 'fetchImageAsBase64', url: src }, resolve);
        });
        if (response && response.base64) {
          base64Images.push(response.base64);
        }
      } catch (e) {
        console.warn("Failed to fetch image:", e);
      }
    }

    if (base64Images.length === 0) {
      setIsExtractingOcr(false);
      setOcrContext('No images could be loaded.');
      setHasOcred(true);
      return;
    }

    chrome.storage.local.get(['ollama_ocr_model', 'ollama_endpoint'], (res) => {
      const ocrModel = res.ollama_ocr_model || 'llava:latest';
      const endpoint = res.ollama_endpoint || 'http://localhost:11434';
      
      chrome.runtime.sendMessage(
        {
          action: 'generateCompletion',
          model: ocrModel,
          endpoint,
          prompt: 'Extract all the text present in this image accurately. Reply ONLY with the extracted text, no conversational filler or preambles.',
          images: base64Images,
          contextLength: 4096
        },
        (response) => {
          if (response && response.result) {
            setOcrContext(response.result);
          } else if (response && response.error) {
            setOcrContext(`OCR Error: ${response.error}`);
          }
          setIsExtractingOcr(false);
          setHasOcred(true);
        }
      );
    });
  };

  // ─── PDF ───
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
    } catch (err) {
      console.error('Failed to parse PDF', err);
      alert('Failed to parse PDF');
    } finally {
      setIsParsing(false);
    }
  };

  // ─── Suitability Score ───
  const analyzeMatch = () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setMatchScore(null);
    setMatchSummary('');

    const allContext = [pageContext, ocrContext, pdfContext].filter(Boolean).join('\n\n');
    const scorePrompt = `You are a career advisor AI. Analyze how well this candidate's resume matches the given job description.

Context (contains both the job description and the resume):
${allContext}

Reply STRICTLY in this format (no other text):
SCORE: [number 0-100]
SUMMARY: [2-3 sentence analysis of strengths and gaps]`;

    chrome.storage.local.get(['ollama_model', 'ollama_endpoint', 'ollama_context_length'], (res) => {
      chrome.runtime.sendMessage(
        {
          action: 'generateCompletion',
          model: res.ollama_model || 'llama3.2:3b',
          endpoint: res.ollama_endpoint || 'http://localhost:11434',
          prompt: scorePrompt,
          contextLength: res.ollama_context_length || 4096
        },
        (response) => {
          if (response && response.result) {
            const text = response.result;
            const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
            const summaryMatch = text.match(/SUMMARY:\s*(.+)/is);
            if (scoreMatch) setMatchScore(Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))));
            setMatchSummary(summaryMatch ? summaryMatch[1].trim() : text);
          } else if (response && response.error) {
            setMatchSummary(`Error: ${response.error}`);
          }
          setIsAnalyzing(false);
        }
      );
    });
  };

  // ─── Generate ───
  const handleGenerate = () => {
    if (!prompt.trim() || isGenerating) return;
    let ctx = '';
    if (pageContext.trim()) ctx += `[Current Webpage Context:]\n${pageContext}\n\n`;
    if (ocrContext.trim()) ctx += `[Extracted Image Context (OCR):]\n${ocrContext}\n\n`;
    if (pdfContext.trim()) ctx += `[Attached PDF Document:]\n${pdfContext}\n\n`;
    generate(prompt, ctx.trim());
  };

  const hasResumeAndJD = pdfContext.trim().length > 50 && (pageContext.trim().length > 50 || ocrContext.trim().length > 50);

  const getScoreColor = (score: number) => {
    if (score >= 75) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Strong Match' };
    if (score >= 50) return { text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Moderate Match' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Weak Match' };
  };

  return (
    <div 
      className="fixed top-3 right-3 w-[560px] bg-[#0c0c1d]/95 backdrop-blur-2xl rounded-2xl shadow-[0_25px_80px_-15px_rgba(99,102,241,0.25)] border border-white/[0.08] text-gray-100 font-sans flex flex-col overflow-hidden"
      style={{ zIndex: 999999, maxHeight: '90vh', pointerEvents: 'auto' }}
      onDrop={(e) => { e.preventDefault(); setIsHovering(false); const f = e.dataTransfer.files[0]; if (f) { processPDF(f); setCurrentStep(2); } }}
      onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
      onDragLeave={() => setIsHovering(false)}
    >
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-r from-violet-600/90 via-indigo-600/90 to-blue-600/90 px-5 py-3 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white">Ollamatch</h1>
            <p className="text-[9px] text-blue-200/60 font-medium tracking-wider uppercase">AI Assistant</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-1.5 hover:bg-white/15 rounded-lg transition-all text-white/70 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* ─── Step Indicator ─── */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
        {STEPS.map((step, i) => {
          const isActive = currentStep === i;
          const isCompleted = currentStep > i;
          const isDisabled = step.id === 1 && pageImages.length === 0;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => !isDisabled && goToStep(step.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  isActive ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30' :
                  isCompleted ? 'text-emerald-400/70 hover:bg-white/[0.04]' :
                  isDisabled ? 'text-gray-700 cursor-not-allowed' :
                  'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                }`}
              >
                {isCompleted ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                {step.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${currentStep > i ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ─── Drop overlay ─── */}
      {isHovering && (
        <div className="absolute inset-0 top-[100px] bg-violet-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-violet-300 border-2 border-dashed border-violet-400/50 m-3 rounded-xl">
          <UploadCloud size={48} className="mb-2 animate-bounce" />
          <p className="text-base font-bold">Drop PDF</p>
        </div>
      )}

      {/* ─── Step Content ─── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <div
          className="flex transition-transform duration-400 ease-in-out h-full"
          style={{ transform: `translateX(-${currentStep * 100}%)` }}
        >
          {/* ════ Step 1: Webpage ════ */}
          <div className="w-full flex-shrink-0 overflow-y-auto p-4 flex flex-col" style={{ minWidth: '100%' }}>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-gray-300">Scraped Webpage Content</span>
              <span className="ml-auto text-[10px] text-gray-600">{(pageContext.length / 1024).toFixed(1)} KB</span>
              <button onClick={refreshPageData} title="Re-scrape current page" className="p-1 hover:bg-white/[0.06] rounded-md text-gray-500 hover:text-violet-400 transition-all"><RefreshCw size={12} /></button>
            </div>
            <textarea
              value={pageContext}
              onChange={(e) => setPageContext(e.target.value)}
              placeholder="No content scraped from this page..."
              className="flex-1 min-h-[200px] w-full p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-[11px] text-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono leading-relaxed placeholder-gray-600"
            />
            <p className="text-[10px] text-gray-600 mt-2">This text was auto-extracted from the current web page. Edit as needed.</p>
          </div>

          {/* ════ Step 2: Images ════ */}
          <div className="w-full flex-shrink-0 overflow-y-auto p-4 flex flex-col" style={{ minWidth: '100%' }}>
            {pageImages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                <ImageIcon size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-semibold">No images found on this page</p>
                <p className="text-xs mt-1 opacity-60">This step will be skipped automatically</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={14} className="text-violet-400" />
                  <span className="text-xs font-bold text-gray-300">Select Images to OCR</span>
                  <span className="ml-auto text-[10px] text-gray-500">{selectedImages.size} of {pageImages.length} selected</span>
                  <button onClick={refreshPageData} title="Re-scrape current page" className="p-1 hover:bg-white/[0.06] rounded-md text-gray-500 hover:text-violet-400 transition-all"><RefreshCw size={12} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {pageImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const newSet = new Set(selectedImages);
                        if (newSet.has(i)) newSet.delete(i); else newSet.add(i);
                        setSelectedImages(newSet);
                      }}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-video transition-all hover:scale-[1.02] ${
                        selectedImages.has(i) ? 'border-violet-500 ring-1 ring-violet-400/30' : 'border-white/[0.06] hover:border-white/[0.15]'
                      }`}
                    >
                      <img src={img.src} alt="" className="w-full h-full object-cover" />
                      {selectedImages.has(i) && (
                        <div className="absolute top-1 right-1 p-0.5 bg-violet-500 rounded-full">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-gray-300 px-1 py-0.5 truncate text-center">
                        {img.width}×{img.height}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedImages.size > 0 && !hasOcred && (
                  <button
                    onClick={handleOcr}
                    disabled={isExtractingOcr}
                    className="w-full py-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/20 rounded-xl text-violet-300 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isExtractingOcr ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    {isExtractingOcr ? 'Extracting text...' : `OCR ${selectedImages.size} Image${selectedImages.size > 1 ? 's' : ''}`}
                  </button>
                )}
                {(hasOcred || ocrContext) && (
                  <div className="mt-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Extracted Text</span>
                    <textarea
                      value={isExtractingOcr ? 'Extracting text from images...' : ocrContext}
                      onChange={(e) => setOcrContext(e.target.value)}
                      disabled={isExtractingOcr}
                      className={`w-full p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-[11px] text-gray-300 h-28 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono leading-relaxed ${isExtractingOcr ? 'opacity-50 animate-pulse' : ''}`}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* ════ Step 3: Documents ════ */}
          <div className="w-full flex-shrink-0 overflow-y-auto p-4 flex flex-col gap-3" style={{ minWidth: '100%' }}>
            <div className="flex items-center gap-2">
              <FileUp size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-gray-300">Upload Document</span>
              <button onClick={refreshPageData} title="Re-scrape current page" className="ml-auto p-1 hover:bg-white/[0.06] rounded-md text-gray-500 hover:text-violet-400 transition-all"><RefreshCw size={12} /></button>
            </div>
            
            {!pdfContext ? (
              <div>
                <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) processPDF(f); }} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="w-full py-8 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-violet-500/20 rounded-xl text-violet-400 hover:bg-violet-500/5 hover:border-violet-500/40 transition-all disabled:opacity-50"
                >
                  {isParsing ? <Loader2 size={28} className="animate-spin" /> : <UploadCloud size={28} />}
                  <span className="text-xs font-bold">{isParsing ? 'Parsing...' : 'Upload PDF (Resume / CV)'}</span>
                  <span className="text-[10px] text-gray-600">Or drag and drop anywhere</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={11} /> Document loaded</span>
                  <button onClick={() => { setPdfContext(''); setMatchScore(null); setMatchSummary(''); }} className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold">Remove</button>
                </div>
                <textarea
                  value={pdfContext}
                  onChange={(e) => setPdfContext(e.target.value)}
                  className="w-full p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-[11px] text-gray-300 h-28 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono leading-relaxed"
                />
              </>
            )}

            {/* Suitability Score */}
            {hasResumeAndJD && (
              <div className="mt-1">
                {matchScore === null && !isAnalyzing && (
                  <button onClick={analyzeMatch} className="w-full py-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600/20 to-blue-600/20 hover:from-violet-600/30 hover:to-blue-600/30 border border-violet-500/20 rounded-xl text-violet-300 text-xs font-bold transition-all">
                    <Gauge size={14} /> Analyze Resume-JD Match
                  </button>
                )}
                {isAnalyzing && (
                  <div className="flex items-center justify-center gap-2 py-3 text-violet-300 text-xs">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="font-semibold">Analyzing match...</span>
                  </div>
                )}
                {matchScore !== null && (
                  <div className={`rounded-xl p-3 ${getScoreColor(matchScore).bg} border border-white/[0.06]`}>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                          <path className="text-white/[0.06]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                          <path className={getScoreColor(matchScore).text} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${matchScore}, 100`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xs font-black ${getScoreColor(matchScore).text}`}>{matchScore}%</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-bold ${getScoreColor(matchScore).text} uppercase tracking-wider mb-0.5`}>{getScoreColor(matchScore).label}</div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">{matchSummary}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════ Step 4: Generate ════ */}
          <div className="w-full flex-shrink-0 p-4 flex flex-col" style={{ minWidth: '100%', maxHeight: '100%' }}>
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={14} className="text-violet-400" />
              <span className="text-xs font-bold text-gray-300">Generate with AI</span>
              <button onClick={refreshPageData} title="Re-scrape current page" className="ml-auto p-1 hover:bg-white/[0.06] rounded-md text-gray-500 hover:text-violet-400 transition-all"><RefreshCw size={12} /></button>
            </div>

            {/* Context Summary */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {pageContext && <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded-full text-[9px] font-bold">🌐 Webpage</span>}
              {ocrContext && <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded-full text-[9px] font-bold">🖼️ OCR</span>}
              {pdfContext && <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded-full text-[9px] font-bold">📄 PDF</span>}
              {!pageContext && !ocrContext && !pdfContext && <span className="text-[10px] text-gray-600">No context attached</span>}
            </div>

            <div className="relative mb-3 flex-shrink-0">
              <textarea
                autoFocus={currentStep === 3}
                className="w-full resize-none rounded-xl border border-white/[0.08] p-3 pr-12 outline-none hover:border-violet-500/30 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10 text-[12px] h-20 bg-white/[0.03] text-gray-200 placeholder-gray-600 transition-all font-[system-ui]"
                placeholder="e.g. Write a cover letter for this job using my resume..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              />
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="absolute bottom-2 right-2 p-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 transition-all hover:shadow-lg hover:shadow-violet-500/20 active:scale-95"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] flex items-start gap-2 mb-3 flex-shrink-0">
                <span>⚠️</span>
                <div><b>Error:</b> {error}</div>
              </div>
            )}

            {output && (
              <div ref={outputRef} className="flex-1 min-h-0 overflow-y-auto mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Bot size={12} className="text-violet-400" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Response</span>
                </div>
                <div className="whitespace-pre-wrap text-[12px] leading-[1.7] text-gray-200 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  {output}
                </div>
              </div>
            )}

            {output && !isGenerating && (
              <div className="flex justify-between gap-2 pt-2 border-t border-white/[0.06] flex-shrink-0">
                <button
                  onClick={() => { navigator.clipboard.writeText(output); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] rounded-lg transition-all"
                >
                  {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
                <div className="flex gap-2">
                  <button onClick={onCancel} className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] rounded-lg transition-all">Discard</button>
                  <button onClick={() => onAccept(output)} className="px-4 py-1.5 text-[11px] font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95">
                    Insert
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Navigation Footer ─── */}
      <div className="px-4 py-2.5 bg-[#0a0a18]/80 border-t border-white/[0.06] flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={currentStep === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-200 disabled:text-gray-700 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={14} /> Back
        </button>
        
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentStep ? 'bg-violet-400 w-4' : 
                i < currentStep ? 'bg-emerald-500/50' : 
                (i === 1 && pageImages.length === 0) ? 'bg-gray-800' :
                'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {currentStep < 3 ? (
          <div className="flex items-center gap-1">
            {currentStep === 1 && pageImages.length > 0 && (
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold text-gray-500 hover:text-gray-300 transition-all"
              >
                <SkipForward size={12} /> Skip
              </button>
            )}
            <button
              onClick={goNext}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-all"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="w-16" /> 
        )}
      </div>
    </div>
  );
};
