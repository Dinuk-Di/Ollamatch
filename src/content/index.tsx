
import { createRoot, Root } from 'react-dom/client';
import { AssistantApp } from '../components/AssistantApp';
import cssText from './style.css?inline';

let reactRoot: Root | null = null;
let currentActiveElement: HTMLElement | null = null;

const mountReactApp = () => {
  let host = document.getElementById('ollamatch-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'ollamatch-host';
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '999999';
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });
    
    const styleElement = document.createElement('style');
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);

    const rootElement = document.createElement('div');
    rootElement.className = 'ollamatch-root w-full h-full';
    shadowRoot.appendChild(rootElement);
    
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
    reactRoot.render(<></>);
  }
  
  const host = document.getElementById('ollamatch-host');
  if (host) host.remove();
  
  reactRoot = null;
};

const insertText = (text: string) => {
  if (currentActiveElement) {
    if (currentActiveElement instanceof HTMLTextAreaElement || currentActiveElement instanceof HTMLInputElement) {
      const val = currentActiveElement.value;
      const strippedVal = val.replace(/[@/]ollamatch/i, '');
      currentActiveElement.value = strippedVal + text;
      currentActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (currentActiveElement.isContentEditable) {
      const htmlText = currentActiveElement.innerHTML;
      const strippedHtml = htmlText.replace(/[@/]ollamatch/i, '');
      currentActiveElement.innerHTML = strippedHtml;
      
      currentActiveElement.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        currentActiveElement.appendChild(document.createTextNode(text));
      }
      
      currentActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  unmountReactApp();
};

let isExtensionEnabled = true;

try {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['extension_enabled'], (res) => {
      if (chrome.runtime.lastError) {
        console.warn("Storage get error:", chrome.runtime.lastError);
        return;
      }
      if (res && res.extension_enabled !== undefined) {
        isExtensionEnabled = res.extension_enabled;
      }
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.extension_enabled) {
          isExtensionEnabled = changes.extension_enabled.newValue;
        }
      }
    });
  }
} catch (e) {
  console.warn("Ollamatch: Could not initialize chrome.storage listeners.", e);
}

// Event Listeners
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'toggleAssistant') {
    if (document.getElementById('ollamatch-host')) {
      unmountReactApp();
    } else {
      currentActiveElement = null;
      mountReactApp();
    }
    sendResponse({ success: true });
    return true;
  }
});

document.addEventListener('input', (e) => {
  if (!isExtensionEnabled) return;

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

  const isAssistantOpen = !!document.getElementById('ollamatch-host');
  
  if (/[@/]ollamatch/i.test(text)) {
    if (!isAssistantOpen) {
      currentActiveElement = target;
      mountReactApp();
    }
  }
});

console.log('Ollamatch Content Script Injected successfully');
