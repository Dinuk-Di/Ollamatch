import { Readability } from '@mozilla/readability';

export const getPageContext = (): string => {
  const MAX_CHARS = 15000;

  // 1. Check if Gmail (special handling for thread history)
  if (window.location.hostname.includes('mail.google.com')) {
    const openedEmails = document.querySelectorAll('.a3s.aiL');
    if (openedEmails && openedEmails.length > 0) {
      let combinedText = '';
      openedEmails.forEach((emailNode) => {
        combinedText += (emailNode as HTMLElement).innerText + '\n\n';
      });
      console.log("Email Context:", combinedText);
      return "Email Thread Context:\n" + combinedText.substring(0, MAX_CHARS);
    }
  }

  // Helper to extract clean innerText
  const extractCleanText = () => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    const scripts = clone.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
    scripts.forEach(s => s.remove());
    
    // Replace multiple newlines and spaces
    let text = clone.textContent || '';
    // Basic cleanup of excessive whitespace from textContent
    text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n');
    console.log("Clean Text:", text);
    return text.trim().substring(0, MAX_CHARS);
  };

  // 2. Generic Page: Use Readability to extract main article text
  try {
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();
    if (article && article.textContent && article.textContent.trim().length > 200) {
      console.log("Normal Page:", article);
      return article.textContent.trim().substring(0, MAX_CHARS);
    } else {
       return extractCleanText();
    }
  } catch (err) {
    return extractCleanText();
  }
};

export const getTopPageImagesBase64 = async (maxImages = 1): Promise<string[]> => {
  return new Promise((resolve) => {
    // Collect all valid img elements that are likely content (not tiny icons)
    const allImgs = Array.from(document.querySelectorAll('img')).map(img => {
      const w = img.naturalWidth || img.width || img.getBoundingClientRect().width;
      const h = img.naturalHeight || img.height || img.getBoundingClientRect().height;
      return { img, w, h, area: w * h };
    });

    const imgs = allImgs
      .filter(item => item.w >= 100 && item.h >= 100 && item.img.src && !item.img.src.startsWith('chrome-extension://'))
      .sort((a, b) => b.area - a.area)
      .map(item => item.img)
      .slice(0, maxImages);

    if (imgs.length === 0) return resolve([]);

    Promise.all(imgs.map(img => new Promise<string | null>(async (res) => {
      let tempImg = img;
      
      // If it's an external URL, bypass Canvas CORS taint by fetching it via the background script
      if (!img.src.startsWith('data:')) {
        try {
          const response = await new Promise<any>((resolveMsg) => {
            chrome.runtime.sendMessage({ action: 'fetchImageAsBase64', url: img.src }, resolveMsg);
          });
          
          if (response && response.base64) {
             tempImg = new Image();
             tempImg.src = `data:${response.contentType || 'image/jpeg'};base64,${response.base64}`;
             // Wait for the data URI to load in this new Image object
             await new Promise(r => { tempImg.onload = r; tempImg.onerror = r; });
          } else {
             console.warn("Background proxy failed to retrieve image:", img.src);
             return res(null);
          }
        } catch(e) {
          console.warn("Failed to message background for image proxy", e);
          return res(null);
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const MAX_DIMENSION = 800;
      let width = tempImg.naturalWidth || tempImg.width || 800;
      let height = tempImg.naturalHeight || tempImg.height || 800;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.floor(height * (MAX_DIMENSION / width));
          width = MAX_DIMENSION;
        } else {
          width = Math.floor(width * (MAX_DIMENSION / height));
          height = MAX_DIMENSION;
        }
      }

      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      try {
        if (ctx) {
          ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = dataUrl.split(',')[1];
          return res(base64Data || null);
        }
      } catch (err) {
        console.warn("Could not extract image due to Canvas taint/CORS:", err);
      }
      res(null);
      
    }))).then(results => {
       resolve(results.filter(Boolean) as string[]);
    });
  });
};

export interface PageImageInfo {
  src: string;
  width: number;
  height: number;
}

/**
 * Returns info about all content-sized images on the page (min 100x100).
 */
export const getPageImageInfos = (): PageImageInfo[] => {
  return Array.from(document.querySelectorAll('img'))
    .map(img => {
      const w = img.naturalWidth || img.width || img.getBoundingClientRect().width;
      const h = img.naturalHeight || img.height || img.getBoundingClientRect().height;
      return { src: img.src, width: w, height: h, area: w * h };
    })
    .filter(item => item.width >= 100 && item.height >= 100 && item.src && !item.src.startsWith('chrome-extension://'))
    .sort((a, b) => b.area - a.area)
    .slice(0, 12)
    .map(({ src, width, height }) => ({ src, width, height }));
};
