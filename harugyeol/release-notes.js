/* Change id and notes together for every user-visible release. Keep notes factual. */
(() => {
  'use strict';
  const release = {
    id: '2026-11-gratitude-1',
    title: '하루결 업데이트',
    notes: [
      '감사일기에서 번호만 있는 줄은 백스페이스 한 번으로 번호를 지울 수 있어요.',
      '좌우 방향키로 이동할 때 자동 번호를 건너뛰고 내용 사이를 이동해요.'
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
