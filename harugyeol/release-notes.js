/* Change id and notes together for every user-visible release. Keep notes factual. */
(() => {
  'use strict';
  const release = {
    id: '2026-11-gratitude-keyboard-1',
    title: '하루결 업데이트',
    notes: [
      '감사일기에서 키보드를 열어도 입력창과 완료 버튼이 보이도록 배치를 개선했어요.',
      '묘은흘림체의 본문·보조 글씨는 과도한 굵게 효과를 줄이고 제목의 구분은 유지했어요.'
    ]
  };
  const key = 'harugyeol-release-seen';
  let acknowledged = false;
  try { acknowledged = localStorage.getItem(key) === release.id; } catch {}
  function open() {
    if (document.querySelector('#releaseNotesDialog')) return;
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'releaseNotesDialog';
    dialog.className = 'panel';
    dialog.setAttribute('aria-labelledby', 'releaseNotesTitle');
    dialog.style.cssText = 'width:min(440px,calc(100% - 32px));max-height:80dvh;overflow:auto;color:var(--ink);border:1px solid var(--line);';
    const title = document.createElement('h2');
    title.id = 'releaseNotesTitle'; title.textContent = release.title;
    const list = document.createElement('ul');
    list.style.cssText = 'padding-left:20px;line-height:1.75';
    release.notes.forEach(note => { const item = document.createElement('li'); item.textContent = note; list.append(item); });
    const footer = document.createElement('div'); footer.style.cssText = 'display:flex;justify-content:flex-end;margin-top:20px';
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = '확인';
    footer.append(button); dialog.append(title, list, footer); document.body.append(dialog);
    const close = () => {
      acknowledged = true;
      try { localStorage.setItem(key, release.id); } catch {}
      dialog.close(); dialog.remove();
      if (previous?.isConnected) previous.focus();
    };
    button.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.showModal(); button.focus();
  }
  document.addEventListener('click', event => { if (event.target.closest('[data-release-notes]')) open(); });
  // Never interrupt a modal, an active form or input; try again when the page is idle.
  const timer = setInterval(() => {
    if (acknowledged) { clearInterval(timer); return; }
    if (document.visibilityState !== 'visible' || document.querySelector('#modal,dialog[open]') || document.activeElement?.matches('input,textarea,select,[contenteditable=true]') || document.querySelector('#journalForm,#routineForm,#todoForm')) return;
    open(); clearInterval(timer);
  }, 1500);
})();
