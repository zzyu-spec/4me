/* Change id and notes together for every user-visible release. Keep notes factual. */
(() => {
  'use strict';
  const release = {
    id: '2026-11-ledger-2',
    title: '하루결 업데이트',
    notes: [
      '하루결 계정으로 사용하는 별도 가계부를 추가했어요. 상단 하루결 제목 옆의 가계부 버튼에서 열 수 있어요.',
      '수입·지출·이체를 기록하고 월별 내역, 달력, 카테고리별 지출을 확인할 수 있어요.',
      '일기의 오늘의 소비에 가계부 지출을 연결했어요. 기존 소비 메모는 유지돼요.',
      '같은 계정의 가계부 지출을 일기의 오늘의 소비에서 확인할 수 있어요. 연결이 끊기면 다시 연동을 눌러 주세요.'
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
