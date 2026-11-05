# 최종 설계 보완 · 하루결 계정 저장

사용자의 추가 요구에 따라 아래의 초기 분석 이후 계정 저장을 확장했습니다. 초기 기기 저장 원본은 유지하고, 로그인 후 연결 대상을 확인합니다. 기존 Firebase 프로젝트·인증 SDK를 재사용하며 아르닛만의 Firestore 경로와 소유자 규칙을 추가합니다. 사진은 같은 Firestore에 조각으로 저장하고 별도 유료 Storage는 도입하지 않습니다. [운영 설정과 충돌 처리](ACCOUNTS.md)를 참고하세요.

기기 보관함은 로그인 UID별로 분리합니다. 앱 표시 이름은 arnit. 아르닛으로 바꾸되 기존 주소·manifest ID·설치 범위와 원본 저장 키는 유지합니다.

---

# 취향 서랍 리디자인 작업 기록

## 1단계 · 분석과 호환 계획

기준: `4me` main `1fc7fa9e27bdf66566db254f5339bcf84c20b532`.

- 취향 서랍: 빌드 없는 HTML/CSS/JS, GitHub Pages `/4me/taste-drawer/`, 전용 manifest와 service worker.
- 저장: `localStorage['taste-drawer-v1']`의 배열. 기존 id, title, category, note, tags(쉼표 문자열), color, photo(data URL), url, status(love/wish), favorite, date, sample.
- 인증: 취향 서랍에는 계정 인증·원격 저장 없음. 호스트 루트 4me의 `cloud.js`는 별도 Firebase 앱/플래너 전용이며 취향 서랍에서 불러오지 않음.
- Firestore: 이메일 인증된 사용자 본인의 `/users/{uid}/planner/current`, `/backups/{revision}`만 허용. 그 외 deny. Storage SDK/규칙이 취향 서랍에 설정되어 있지 않음. 플래너 문서에 아카이브 데이터를 섞거나 규칙을 우회하지 않음.
- 범위: 루트 4me 앱, 인증·보안 규칙, 다른 IndexedDB와 캐시는 변경하지 않음. 외부 메타데이터 자동 추출/실시간 가격 추적/공개 공유/계정 동기화를 지원한다고 표시하지 않음.

### 데이터 모델

브라우저 IndexedDB `taste-drawer-library`의 원자적 트랜잭션에 라이브러리와 이미지 blob을 보관.

- library: schemaVersion, revision, groups, items, categories, tags, layouts, trash, migration.
- groups: moodboard / collection / wishlist / bucket, memberIds. 그룹은 항목 ID만 참조.
- items: reference / taste / product / goal. 이미지·목표 실체는 한 번 저장하며 여러 그룹이 참조. goal의 done/completedAt/review/afterImageId는 모든 목록에서 공유.
- assets: SHA-256 해시를 키로 하는 blob과 mime/크기. 동일 파일 중복 업로드는 같은 ID 참조.
- layouts: 무드보드 ID별 자유 배치 좌표·크기. 그리드 순서와 별개 보관.
- tags: 공통 태그 레지스트리. 각 항목은 태그 문자열 목록 참조.
- trash: soft-delete 시각과 원래 항목/그룹을 유지. 아카이브와 별개 복원.

### 비파괴 호환

처음 시작 시 기존 배열을 검증한 후 원본 문자열을 안전 백업에 보관하고 IndexedDB로 복사. 기존 localStorage는 삭제/수정하지 않음. ID·기존 필드를 legacy에 보존. love는 취향 항목, wish는 기존 버킷리스트의 목표로 복사. 기존 카테고리와 즐겨찾기·사진 유지. sample:true는 사용자의 기록으로 저장하지 않고 별도 예시로만 표시. 기존 원본에서 제거하지 않음. 복사 실패 시 트랜잭션 롤백과 복구 안내, 빈 라이브러리로 덮어쓰지 않음. 이전 JSON 백업/신규 전체 백업을 지원. 안전 백업 원본 다운로드 제공. 다중 탭 저장은 revision 검증으로 충돌 시 거절.

### 실행 단계와 검증

1. 분석/문서: 완료. 기존 원격 소스·rules 확인. 다음: 공통 UI.
2. 디자인·내비게이션·홈: CSS 변수, 로컬 무료 폰트, 6개 메뉴·사용자 그룹·모바일 탐색·빠른 추가.
3. 무드보드: 다중 그룹 CRUD/복제/정렬·업로드·URL·텍스트·상세·다중 연결·팔레트·그리드 순서.
4. 콜라주: 별도 좌표 모델, 포인터 이동/리사이즈와 키보드·숫자 입력 대체, 저장/복원.
5. 취향/위시: 카테고리 CRUD·평점·다중 컬렉션·상품 필드·구매 완료 기록.
6. 버킷: 다중 목록·공유 목표·기한·완료일·후기/사진·진행률·복제.
7. 아카이브/검색: 보관/완료·기간/유형 필터·유형별 통합 검색·태그·별도 휴지통/복원.
8. 검증: 마이그레이션/중복 이미지/공유 목표/백업/충돌·실패·오프라인·모바일·키보드 확인 후 기존 Pages로 배포.

공개 공유·원격 계정 연동은 새로운 서비스 또는 보안 규칙 변경이 필요하므로 이번 로컬 아카이브에는 도입하지 않음. 기기 저장은 OS/브라우저 삭제로 사라질 수 있어 전체 백업을 제공.
