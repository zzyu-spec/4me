# 담록 — 계정 저장 설정

담록은 **담아 기록하다**의 줄임말입니다.

주소: https://zzyu-spec.github.io/4me/damrok/

아르닛과 같은 GitHub Pages와 Firebase 프로젝트 `harugyeol-e7866`, 이메일 인증 계정을 사용합니다. 담록 자료는 기본 Firestore 데이터베이스 `(default)`의 별도 경로에 저장합니다. 아르닛 데이터베이스와 플래너·가계부 자료는 읽거나 수정하지 않습니다.

## 처음 한 번: Firestore 규칙 적용

현재 사이트 배포 연결에는 Firebase 관리자 권한이 없어 규칙을 자동으로 게시하지 않았습니다. 로그인과 기기 저장은 가능하지만, 규칙을 적용하기 전에는 계정 저장이 권한 오류로 표시됩니다.

1. [Firebase Console](https://console.firebase.google.com/project/harugyeol-e7866/firestore) → **Firestore Database → `(default)` → 규칙**을 엽니다. `arnit` 데이터베이스를 선택하지 마세요.
2. [저장소 루트 firestore.rules](https://github.com/zzyu-spec/4me/blob/main/firestore.rules)의 전체 내용을 복사해 적용하고 **게시**합니다. 이 파일은 기존 플래너·아르닛·가계부 규칙을 보존하면서 담록 경로만 추가합니다.
3. 담록에서 로그인한 뒤 **동기화**를 누릅니다. 상단의 **계정에 저장됨**을 확인하세요.
4. 두 번째 기기에서 같은 계정으로 로그인하여 사진과 자료가 나타나는지 확인합니다.

Firebase CLI에 이미 관리자 계정이 연결돼 있다면 저장소 루트에서 다음 명령으로 기본 DB 규칙만 게시할 수도 있습니다.

```sh
firebase deploy --only firestore:rules --project harugyeol-e7866
```

## 저장 방식

- 자료: `/users/{uid}/damrokEntries/{id}`. revision을 확인하는 트랜잭션으로 동시 수정을 감지합니다.
- 사진 원본: `/users/{uid}/damrokAssets/{sha256}/chunks/{index}`. 최대 8MB, 450,000자 단위로 분할하고 SHA-256으로 검증합니다.
- 기기: IndexedDB `damrok-archive-account-<uid>`. 로그아웃이나 계정 변경 시 다른 계정의 자료는 표시되지 않습니다.
- 휴지통은 복구 가능한 기록으로 계정에 동기화합니다. 서버 원본의 영구 삭제는 제공하지 않습니다.
- 같은 자료가 여러 기기에서 바뀌면 사용할 버전을 선택합니다. 계정 버전을 적용하기 전에 현재 기기 전체 백업을 내려받습니다.
- 전체 JSON 백업에 사진 원본과 휴지통을 포함합니다. 가져올 자료 전체를 검증하고 기기 저장을 원자적으로 처리합니다.

기기의 브라우저 데이터 삭제 전에는 전체 백업을 내려받아 주세요. 저장 상태가 오류일 때는 다른 기기에 아직 전송되지 않았을 수 있습니다.

## 공개 범위

GitHub Pages에는 앱 코드만 공개됩니다. 사용자 자료와 사진을 저장소에 올리지 않습니다. 이메일 인증된 본인의 Firebase UID 경로에만 읽기·쓰기를 허용하는 규칙을 제공합니다.
