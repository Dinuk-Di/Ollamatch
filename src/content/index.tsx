
import { createRoot, Root } from 'react-dom/client';
import { AssistantApp } from '../components/AssistantApp';
import { llmFactory } from '../services/llm';
import { getPageContext } from '../services/pageScraper';
import cssText from './style.css?inline';

let reactRoot: Root | null = null;
let currentActiveElement: HTMLElement | null = null;

const mountReactApp = () => {
  let host = document.getElementById('browser-assist-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'browser-assist-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '999999';
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    
    // Inject Tailwind CSS into the shadow root
    const styleElement = document.createElement('style');
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);

    const rootElement = document.createElement('div');
    rootElement.className = 'browser-assist-root w-full h-full';
    shadowRoot.appendChild(rootElement);

    // Instead of importing CSS that Vite injects globally, we might need a workaround for shadow DOM, 
    // but typically CRXJS allows global css or we inject the text of style.css directly.
    // For now we assume typical utility classes work if injected into document head.
    // Since we used @tailwind in style.css, Vite will inject it into document.head.
    
    reactRoot = createRoot(rootElement);
  }
  
  reactRoot?.render(
    <AssistantApp 
      onAccept={(text) => insertText(text)} 
      onCancel={unmountReactApp} 
    />
  );
};

const unmountReactApp = () => {
  if (reactRoot) {
    reactRoot.render(<></>); // Unmount safely
  }
  
  // Actually remove the host element so we know it's closed
  const host = document.getElementById('browser-assist-host');
  if (host) host.remove();
  
  reactRoot = null;
};

const insertText = (text: string) => {
  if (currentActiveElement) {
    if (currentActiveElement instanceof HTMLTextAreaElement || currentActiveElement instanceof HTMLInputElement) {
      // Replace @browserassist or /browserassist if it exists
      const val = currentActiveElement.value;
      const strippedVal = val.replace(/[@/]browserassist/i, '');
      
      // Update value and preserve cursor position
      currentActiveElement.value = strippedVal + text;
      currentActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (currentActiveElement.isContentEditable) {
      // Securely insert text into contentEditable element to prevent XSS
      const htmlText = currentActiveElement.innerHTML;
      const strippedHtml = htmlText.replace(/[@/]browserassist/i, '');
      currentActiveElement.innerHTML = strippedHtml;
      
      // Focus the element and firmly insert plain text securely
      currentActiveElement.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move caret to end
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Fallback
        currentActiveElement.appendChild(document.createTextNode(text));
      }
      
      currentActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  unmountReactApp();
};

// Autocomplete Logic
let typingTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOCOMPLETE_DELAY = 1000;

const handleAutocomplete = async (element: HTMLTextAreaElement | HTMLInputElement | HTMLElement, text: string) => {
  if (text.length < 10) return; // Too short to autocomplete
  const context = getPageContext();
  try {
    const provider = await llmFactory.getProvider();
    const completion = await provider.generateCompletion(text, context);
    if (!completion) return;
    
    // Create an inline ghost suggestion (simplified concept)
    console.log("[BrowserAssist] Inline suggestion:", completion);
    
    // Visual indicator
    const indicatorHost = document.createElement('div');
    indicatorHost.style.position = 'fixed';
    indicatorHost.style.bottom = '24px';
    indicatorHost.style.left = '50%';
    indicatorHost.style.transform = 'translateX(-50%)';
    indicatorHost.style.zIndex = '999999';
    indicatorHost.style.pointerEvents = 'none';
    
    const indicatorShadow = indicatorHost.attachShadow({ mode: 'open' });
    const indicatorStyle = document.createElement('style');
    indicatorStyle.textContent = cssText;
    indicatorShadow.appendChild(indicatorStyle);
    
    const chip = document.createElement('div');
    chip.className = 'bg-slate-900 border border-slate-700 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-3 transition-opacity duration-300 opacity-0';
    chip.innerHTML = `
      <div class="flex items-center justify-center w-7 h-7 bg-indigo-600 rounded-full shrink-0 shadow-inner">✨</div>
      <div class="truncate max-w-md"><span class="opacity-60 mr-1 font-mono text-xs">TAB to accept:</span> ${completion}</div>
    `;
    indicatorShadow.appendChild(chip);
    document.body.appendChild(indicatorHost);
    
    requestAnimationFrame(() => {
      chip.style.opacity = '1';
    });

    const cleanup = () => {
      chip.style.opacity = '0';
      setTimeout(() => indicatorHost.remove(), 300);
      element.removeEventListener('keydown', handleTab, true);
      element.removeEventListener('input', removeTab);
      element.removeEventListener('blur', removeTab);
    };

    const handleTab = (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          element.value += completion;
        } else if (element.isContentEditable) {
          element.innerText += completion;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        cleanup();
      }
    };
    
    // Use capture: true to intercept Tab before the site does
    element.addEventListener('keydown', handleTab, true);
    
    const removeTab = () => cleanup();
    element.addEventListener('input', removeTab);
    element.addEventListener('blur', removeTab);
    
  } catch (err: any) {
    console.error("Autocomplete backend failed", err);
    showErrorChip(err.message || String(err));
  }
};

const showErrorChip = (message: string) => {
  const indicatorHost = document.createElement('div');
  indicatorHost.style.position = 'fixed';
  indicatorHost.style.bottom = '24px';
  indicatorHost.style.left = '50%';
  indicatorHost.style.transform = 'translateX(-50%)';
  indicatorHost.style.zIndex = '999999';
  indicatorHost.style.pointerEvents = 'none';

  const indicatorShadow = indicatorHost.attachShadow({ mode: 'open' });
  const indicatorStyle = document.createElement('style');
  indicatorStyle.textContent = cssText;
  indicatorShadow.appendChild(indicatorStyle);

  const chip = document.createElement('div');
  chip.className = 'bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-3 transition-opacity duration-300 opacity-0';
  chip.innerHTML = `
    <div class="flex items-center justify-center w-6 h-6 shrink-0">⚠️</div>
    <div class="truncate max-w-md">Autocomplete Error: ${message}</div>
  `;
  indicatorShadow.appendChild(chip);
  document.body.appendChild(indicatorHost);

  requestAnimationFrame(() => {
    chip.style.opacity = '1';
  });

  setTimeout(() => {
    chip.style.opacity = '0';
    setTimeout(() => indicatorHost.remove(), 300);
  }, 4000);
};

// Event Listeners
document.addEventListener('input', (e) => {
  const target = e.target as HTMLElement;
  if (!target) return;
  
  let text = '';
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    text = target.value;
  } else if (target.isContentEditable) {
    text = target.innerText;
  } else {
    return;
  }

  // Explicit Trigger
  const isAssistantOpen = !!document.getElementById('browser-assist-host');
  
  if (/[@/]browserassist/i.test(text)) {
    if (!isAssistantOpen) {
      currentActiveElement = target;
      mountReactApp();
    }
  } else if (!isAssistantOpen) {
    // Inline AutoComplete Trigger
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      handleAutocomplete(target, text);
    }, AUTOCOMPLETE_DELAY);
  }
});

console.log('BrowserAssist Content Script Injected successfully');
