# 안내 페이지 렌더링

firebase-setup.html은 guide.js를 통해 FIREBASE-SETUP.md를 읽는다. 안내 내용을 수정할 때는 Markdown 원문만 고치면 되며 별도 HTML 복사본을 만들지 않는다. HTML로 보일 수 있는 기호는 원문에서 인라인 코드로 감싼다. marked로 해석한 HTML은 DOMPurify로 정리한 뒤 삽입한다. 런타임에 외부 CDN이 필요하지 않다.

번들 의존성: marked@18.1.2, dompurify@3.4.17, esbuild@0.28.2. 고지는 guide.js.LEGAL.txt에 유지한다.

재생성 시 별도 임시 디렉터리에 위 버전들을 설치하고 tools/guide-entry.js를 그 디렉터리로 복사한다. 해당 esbuild로 --bundle --minify --format=iife --target=es2020 --legal-comments=external 옵션을 사용해 guide.js를 생성한다.

Markdown 강조가 괄호로 끝나고 바로 한글 조사가 붙으면 CommonMark가 닫는 구분자로 인식하지 못할 수 있다. `**Spark(무료)**를` 대신 `**Spark(무료)를**`처럼 조사까지 넣어야 한다. 웹 기호 `</>`는 인라인 코드로 감싼다.
