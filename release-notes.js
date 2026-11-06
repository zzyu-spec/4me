/* Change id and notes together for every user-visible release. Keep notes factual. */
(() => {
  'use strict';
  const release = {
    id: '2026-11-push-1',
    title: '하루결 업데이트',
    notes: [
      '화면이 꺼져 있거나 앱을 닫은 상태에서도 일정·투두·습관 알림을 받을 수 있도록 지원합니다.',
      '종 아이콘에서 알림을 켜고 이 기기를 연결해 주세요. iPhone은 홈 화면에 추가한 하루결에서 사용할 수 있어요.',
      '앞으로 업데이트하면 바뀐 내용을 이 창에서 확인할 수 있어요.'
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
