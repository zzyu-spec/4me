// Rebuild with the pinned dependency versions recorded in GUIDE-RENDERING.md.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const article = document.querySelector('#guide');
async function renderGuide() {
  try {
    const response = await fetch('./FIREBASE-SETUP.md', { cache: 'no-store' });
    if (!response.ok) throw new Error('Guide unavailable');
    const source = await response.text();
    article.innerHTML = DOMPurify.sanitize(marked.parse(source));
    for (const link of article.querySelectorAll('a[href]')) {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.origin !== location.origin) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    }
    article.removeAttribute('aria-busy');
  } catch {
    article.replaceChildren();
    const message = document.createElement('p');
    message.textContent = '안내를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침하거나 아래 GitHub 원문을 열어 주세요.';
    article.appendChild(message);
    article.removeAttribute('aria-busy');
  }
}
renderGuide();
