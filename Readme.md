BrowserAssist: High-Performance AI Writing Agent

**BrowserAssist** is a local-first Chrome Extension that provides **near-instant** text completion and generation. It integrates deeply with your browser to read the active tab's context (emails, articles, documentation) and uses that to generate relevant text in milliseconds.

## 🚀 Key Features

* **⚡ Zero-Latency Autocomplete:** Designed for "thought-speed" generation. Characters stream instantly into the text field.
* **🧠 Deep Context Awareness:** Automatically reads and parses the active tab (Gmail thread, webpage content, or PDF viewer) to understand *what* you are writing about without you copying/pasting.
* **🤖 Multi-Modal Backend:**
  1. **Chrome Built-in AI (Gemini Nano):** (Fastest) Uses the browser's native NPU-accelerated model. Zero network overhead.
  2. **WebLLM (WebGPU):** Runs optimized models (Phi-3, Llama-3-8B) directly in the VRAM of your browser tab.
  3. **Local Ollama:** Connects to your local powerful rig (Llama-3, Mistral) for heavy-duty tasks.
* **📄 Smart Reference:** Drag & drop PDFs (<4 pages) to ground the AI's response in specific documents.
* **Universal Trigger:** Type `@browserassist` in any input field to summon the context-aware UI.

---

## 🛠️ Technology Stack & Performance

* **Frontend:** React 18, TypeScript, Vite, TailwindCSS
* **Extension Core:** CRXJS (Hot Reloading), Shadow DOM (Style Isolation)
* **Performance Engine:**
  * **Streaming:** custom `ReadableStream` implementation for Token-by-Token rendering.
  * **Context Extraction:** `@mozilla/readability` (lightweight DOM parsing).
  * **Inference:** `window.ai` (Chrome), `@mlc-ai/web-llm` (WebGPU).

---

## 🏗️ Architecture: The "Instant" Pipeline

To achieve near-instant inference, we bypass standard API waiting times.

### 1. The Context Engine (`src/services/context/`)

Before the user even finishes typing the prompt, the extension captures the page state.

* **Gmail:** Targets specific DOM nodes (`.a3s.aiL`) to get the exact email thread history.
* **General Web:** Uses a lightweight Readability parser to strip ads/nav bars and get the pure text content of the article/page.
* **Optimization:** Context is token-limited (sliding window) to ensure the LLM doesn't choke on processing time.

### 2. The Streaming Bridge

We do not wait for the full response.

* **Ollama/WebLLM:** We attach a listener to the output stream.
* **Shadow DOM:** The React UI updates typically at 60fps, rendering tokens the moment they are predicted.

---

## ⚙️ Installation & Setup

### 1. Prerequisites

* **Node.js** (v18+)
* **GPU Recommended** (for WebLLM)
* **Chrome Canary/Dev** (Required for "Chrome Built-in AI" mode)

### 2. Quick Start

**Bash**

```
# Clone the repository
git clone https://github.com/yourusername/browser-assist.git
cd browser-assist

# Install dependencies
npm install

# Run the high-performance dev server
npm run dev
```

### 3. Load into Chrome

1. Navigate to `chrome://extensions`.
2. Enable  **Developer Mode** .
3. Click **Load Unpacked** -> Select the `dist` folder.

---

## 🧠 Optimizing for Speed (The "Instant" Config)

For the absolute fastest response times, follow this configuration guide:

### Option A: Chrome Built-in AI (Gemini Nano) - *Fastest*

* **Why:** Uses the device's NPU (Neural Processing Unit) if available. No download lag, no VRAM overhead.
* **Setup:**
  1. Open Chrome Flags (`chrome://flags`).
  2. Set `Enables optimization guide on device` to  **Enabled BypassPerfRequirement** .
  3. Set `Prompt API for Gemini Nano` to  **Enabled** .
  4. Restart Chrome.

### Option B: WebLLM (Phi-3 Mini) - *Balanced*

* **Why:** Microsoft's Phi-3 is tiny (3.8B) but incredibly smart. It loads into WebGPU VRAM quickly.
* **Setup:** Select **"Phi-3-mini-4k-instruct-q4f16_1"** from the extension dropdown. The first run will take 30s to cache; subsequent runs are instant.

### Option C: Local Ollama - *Most Powerful*

* **Why:** If you have a dedicated RTX 3060+, running Llama-3 locally is faster than cloud APIs.
* **Setup:**
  **Bash**

  ```
  # Allow Chrome to talk to Ollama
  OLLAMA_ORIGINS="chrome-extension://*" ollama serve
  ```

---

## 📂 Implementation Details

### Context Extraction Logic (`src/services/pageScraper.ts`)

This is how we instantly grab "what you are looking at":

**TypeScript**

```
import { Readability } from '@mozilla/readability';

export const getPageContext = (): string => {
  // 1. Check if Gmail (special handling for thread history)
  if (window.location.hostname.includes('google.com')) {
    const emailBody = document.querySelector('.a3s.aiL');
    if (emailBody) return "Email Thread Context: " + emailBody.innerText;
  }

  // 2. Generic Page: Use Readability to extract main article text
  // We clone the document to avoid messing with the live DOM
  const documentClone = document.cloneNode(true); 
  const article = new Readability(documentClone as Document).parse();
  
  return article ? article.textContent : document.body.innerText.substring(0, 3000);
};
```

### Zero-Latency Stream Handler (`src/hooks/useLLM.ts`)

This React hook manages the instant updates.

**TypeScript**

```
const generateText = async (prompt: string, context: string) => {
  const combinedPrompt = `
    Task: ${prompt}
    Background Context: ${context}
    ---
    Start writing immediately. Do not chatter.
  `;

  // Provide a callback that updates UI state on every token
  await activeService.generate(combinedPrompt, (chunk) => {
    setOutput((prev) => prev + chunk); // React re-renders immediately
  });
};
```

---

## 📜 License

MIT
