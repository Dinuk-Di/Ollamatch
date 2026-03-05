import { Readability } from '@mozilla/readability';

export const getPageContext = (): string => {
  const MAX_CHARS = 15000;

  // Helper to extract clean innerText
  const extractCleanText = () => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    const scripts = clone.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
    scripts.forEach(s => s.remove());
    
    // Replace multiple newlines and spaces
    let text = clone.textContent || '';
    // Basic cleanup of excessive whitespace from textContent
    text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n');
    return text.trim().substring(0, MAX_CHARS);
  };

  // 2. Generic Page: Use Readability to extract main article text
  try {
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();
    if (article && article.textContent && article.textContent.trim().length > 200) {
      // If Readability succeeds and gives a reasonable chunk, use it.
      return article.textContent.trim().substring(0, MAX_CHARS);
    } else {
       return extractCleanText();
    }
  } catch (err) {
    return extractCleanText();
  }
};
