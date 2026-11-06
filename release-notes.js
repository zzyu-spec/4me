/* Change id and notes together for every user-visible release. Keep notes factual. */
(() => {
  'use strict';
  const release = {
    id: '2026-11-ledger-3',
    title: '하루결 업데이트',
    notes: [
      '가계부에서 수입·지출 카테고리를 따로 만들고 선택할 수 있어요. 카테고리 관리에서 추가해 주세요.',
      '카테고리를 선택 목록에서 빼도 기존 내역과 소비 메모는 유지돼요.',
      '이체의 이체 받을 수단 입력칸을 제거했어요. 기존 기록에 저장한 정보는 보존돼요.',
      '카테고리 계정 저장과 새 이체 저장은 최신 보안 규칙이 적용된 서버에서 사용할 수 있어요. 계정 저장 상태를 확인해 주세요.'
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
