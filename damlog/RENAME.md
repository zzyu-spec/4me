# Damlog 이름 변경 및 Firebase 이전

GitHub 소스 폴더와 사이트 주소는 `damlog`입니다. 이전 `/damrok/` 주소도 같은 앱으로 유지합니다. Firebase 프로젝트 `harugyeol-e7866`과 공유 Authentication은 그대로입니다.

**현재 서비스 DB는 아직 `damrok`입니다.** 관리자 권한 없이 DB 생성·규칙 게시·서버 복사를 완료했다고 보고하지 않습니다. Firestore DB ID는 이름만 바꿀 수 없으므로 아래 순서로 복사한 뒤 연결을 바꿉니다. 기존 DB와 기기 자료는 삭제하지 않습니다.

## 관리자 작업

1. 모든 기기에서 편집을 마치고 로그인된 기기의 `전체 백업`을 내려받습니다. 이전 중에는 편집을 멈춥니다. 아직 계정에 올라가지 않은 기기 자료가 있는지도 확인합니다.
2. [Firebase Firestore](https://console.firebase.google.com/project/harugyeol-e7866/firestore)에서 데이터베이스 추가 → 표준 Firestore Native 모드 → ID **damlog**로 새 데이터베이스를 만듭니다. 리전은 기존 `damrok`과 맞춥니다. 공유 프로젝트나 `(default)`는 변경하지 않습니다.
3. [damlog 규칙 화면](https://console.firebase.google.com/project/harugyeol-e7866/firestore/databases/damlog/rules)에 이 폴더의 [firestore.rules](./firestore.rules) 전체 내용을 게시합니다. UID 소유자 제한과 50MB 파일용 청크 제한을 유지합니다. `firebase.damlog.json`은 새 DB만 가리키는 배포 설정이고, `firebase.json`은 현재 서비스용 기존 DB 설정입니다.
4. Firebase 관리자 계정으로 Cloud Shell에서 저장소를 내려받고 다음 명령을 실행합니다. 이미 체크아웃이 있다면 최신 main으로 갱신합니다. 비밀키를 채팅이나 저장소에 올릴 필요는 없습니다.

```sh
git clone https://github.com/zzyu-spec/4me.git damlog-migration
cd damlog-migration
npm install --no-save --package-lock=false firebase-admin
gcloud auth application-default login
node scripts/copy-damlog-database.mjs
node scripts/copy-damlog-database.mjs --copy
node scripts/copy-damlog-database.mjs --verify
```

기본 명령은 읽기 전용 사전 검사입니다. `--copy`는 모든 UID의 문서와 파일 청크를 같은 경로로 복사하고 원본/대상을 해시로 검증합니다. 기존 대상에 다른 내용이 있으면 덮어쓰지 않고 중단합니다. 대상 일부만 복사된 경우에도 원본은 그대로 유지되고, 동일한 문서는 재실행 시 건너뜁니다. 원본이 복사 중 바뀌어도 중단합니다. 오류가 나면 앱 연결을 바꾸지 마세요.

## 검증 후 앱 연결 전환

- 관리자 명령의 `--verify` 결과가 `verified: true`인지 확인한 뒤 결과를 알려주세요. 원본이 변경되지 않은 상태에서 `damlog/account.mjs`의 `DATABASE_ID`를 `damlog`로 바꾸고 배포합니다. **현재 코드는 아직 전환하지 않았습니다.**
- 호환성을 위해 컬렉션 경로 `users/{uid}/damrokEntries`, `users/{uid}/damrokAssets`와 기기 저장 키는 유지합니다. 새 DB에서 같은 경로를 사용하므로 기존 revision과 파일 해시가 이어집니다.
- 같은 계정으로 두 브라우저에서 추가/수정/파일 원본 열기, 다른 사용자 접근 차단, 로그아웃 후 접근 차단을 확인합니다. 이것은 실제 계정 검증이 필요하며 모의 테스트로 대체했다고 보고하지 않습니다.
- 검증 후에도 기존 DB와 기기 자료를 삭제하지 않습니다. 문제가 있으면 편집을 멈추고 양쪽을 백업한 뒤 원인을 확인합니다. 전환 이후 새 DB에 쓴 내용을 검토하지 않은 채 연결만 되돌리지 않습니다.
