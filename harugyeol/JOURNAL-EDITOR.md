# 감사일기 키보드와 서체

감사일기 팝업은 `visualViewport.height`와 `offsetTop`에 맞추어 표시한다. iOS 키보드 표시·숨김/화면 이동 시 resize/scroll을 반영하고, 미지원 환경에서는 window.innerHeight를 사용한다. 헤더와 완료 버튼은 본문 스크롤과 분리하며 긴 글은 내부 본문 영역에서 스크롤한다.

textarea의 자동 높이 증가를 유지한다. 긴 글을 입력할 때 같은 폰트/너비로 임시 비표시 측정 요소를 만들어 커서 줄만 보이도록 본문을 스크롤한다. 텍스트는 textContent로만 복사하고 측정 후 즉시 제거하며 서버로 보내거나 기록 값을 변경하지 않는다. 기존 백스페이스/번호 건너뛰기/재정렬/자동 저장 로직은 유지한다.

묘은흘림체에는 원본 Regular만 들어 있으므로 별도 Light 파일을 생성하거나 원본을 수정하지 않는다. 본문·보조 글씨·입력칸에서는 브라우저 합성 볼드를 끄고 원래 400 굵기를 사용하며 제목·중요 요약에는 기존 강조를 남긴다. 다른 서체와 라이트/다크 선택은 변경하지 않는다.

검사: tools/gratitude-keyboard-viewport.test.cjs(visualViewport 축소·offset 이동 모형), gratitude-navigation.test.cjs, gratitude-numbering.test.cjs, journal-record-dialogs.test.cjs, myoeun-font-choice.test.cjs. 320–588px 라이트/다크에서 버튼·헤더 경계, 긴 글 커서/자동 높이/저장, Regular 본문과 제목 강조를 확인한다. 실제 iPhone 키보드와 입력 도구 막대를 직접 실행한 검사는 아니다. 사용자 데이터 형식·기록·사진 저장·Firebase 규칙은 변경하지 않는다.
