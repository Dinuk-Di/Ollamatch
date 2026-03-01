import { Readability } from '@mozilla/readability';

export const getPageContext = (): string => {
  // 1. Check if Gmail (special handling for thread history)
  if (window.location.hostname.includes('mail.google.com')) {
    const openedEmails = document.querySelectorAll('.a3s.aiL');
    if (openedEmails && openedEmails.length > 0) {
      let combinedText = '';
      openedEmails.forEach((emailNode) => {
        combinedText += (emailNode as HTMLElement).innerText + '\n\n';
      });
      return "Email Thread Context:\n" + combinedText.substring(0, 5000);
    }
  }

  // 2. Generic Page: Use Readability to extract main article text
  try {
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();
    return article && article.textContent ? article.textContent.substring(0, 5000) : document.body.innerText.substring(0, 3000);
  } catch (err) {
    return document.body.innerText.substring(0, 3000);
  }
};
