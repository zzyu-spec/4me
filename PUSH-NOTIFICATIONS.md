# 종료 상태 푸시 알림 — 구현 및 배포 검토

## 비용과 승인 경계 (2026-11-04)

GitHub Pages는 HTTPS 정적 파일과 Service Worker를 제공하지만 예약 작업을 실행하는 서버는 제공하지 않는다. 이번 구현은 **표준 Web Push(VAPID) + Firebase Functions 2세대 HTTPS API + Cloud Scheduler 1분 작업 + 기존 Firestore**를 사용한다. FCM 전용 SDK/토큰은 추가하지 않는다. Apple/Google/Mozilla Push Service로 암호화된 알림을 전달한다.

**Firebase 프로젝트 변경·Blaze 전환·결제 연결·API 활성화·Secret Manager 키 등록·서버 배포는 아직 수행하지 않는다. 사용자 승인 이후의 단계다.** 프런트엔드 설정은 `enabled:false`로 출고하며, 실제 서버가 없으면 종료 알림이 활성화됐다고 표시하지 않는다. 기존 실행 중 알림은 유지한다.

- Functions 배포에는 Blaze 결제 계정 연결이 필요하다. 무료 사용량 이내라도 비용이 영원히 0원이라고 보장할 수 없다.
- Scheduler는 통상 작업 1개당 월 US$0.10, 결제 계정당 처음 3개 작업 무료 할당량이 있다. 1분마다 실행하는 이번 작업은 월 약 43,200~44,640회 함수 호출이다. 기존 계정의 무료 할당량 사용 여부에 따라 실제 청구가 달라진다.
- Functions의 실행 시간/메모리/네트워크, Cloud Build 및 Artifact Registry, Firestore 읽기/쓰기/저장, Secret Manager 접근/버전 보관 비용이 별도로 적용될 수 있다. 최소 인스턴스는 0, 최대 인스턴스는 1로 제한하지만 비용 상한을 보장하는 설정은 아니다.
- 이 개인용 구현은 매분 활성 기기를 페이지 단위로 읽고 사용자별 최신 스냅샷을 읽는다. 30일 기준 항상 활성 기기 D개, 사용자 U명일 때 대략 `43,200 × (D + U)` 문서 읽기 + 빈 질의/전송 기록 정리/인증 확인 비용이 기본량이다. 예약 후보의 중복 확인·발송 시도·테스트·등록 비용은 추가다. 기기 1개·사용자 1명이라면 기본 약 86,400회 읽기/월이다. 사용자 수가 늘면 예약 큐로 전환하는 별도 설계가 필요하다.
- Web Push 전송 프로토콜 자체에는 이 프로젝트가 별도로 구입하는 메시지 요금제가 없다. FCM도 메시지 전송은 일반적으로 무료지만 예약 서버 비용은 똑같이 필요하다. FCM 도입은 이번에는 SDK/토큰 관리가 늘어 선택하지 않았다.
- Cloudflare Workers Cron/무료 요금제도 검토했으나, 무료 실행/CPU 한도와 별도 저장소·Firebase 인증 검증·예약 동기화 경로가 필요하다. 기존 Firestore의 확정된 기록을 직접 읽는 Firebase 방식을 먼저 구현한다. Workers를 실제로 배포하거나 무료 동작을 검증하지 않았다.

공식 참고 링크:
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/functions/schedule-functions
- https://cloud.google.com/scheduler/pricing
- https://cloud.google.com/secret-manager/pricing
- https://firebase.google.com/docs/cloud-messaging/js/client
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://developers.cloudflare.com/workers/platform/pricing/

이 환경에서 위 문서 도메인 접근은 프록시 403으로 거절됐다. 따라서 위 가격은 기존 공개 요금 체계에 따른 검토용 수치이며 **2026년 현재 금액의 실시간 확인 결과가 아니다**. 배포 승인 전 Firebase/GCP 콘솔의 해당 지역 최신 요금, 무료 할당량, 예산 경보를 반드시 확인한다. 예산 경보는 과금 차단 장치가 아니다.

## 기존 구조

- `index.html`: `reminderOptions`, `dueReminders`, `checkReminders`가 표시 중인 문서에서 30초마다 확인한다. 일정 사전 알림과 모아보기 설정은 `state.reminders`, 일정별 `reminderMinutes`, 습관별 `reminderTime`에 보관한다.
- `planner-enhancements.js`: 습관의 개별 알림 시각/반복 예정일 처리.
- `sw.js`: 오프라인 자산 캐시와 알림 클릭. 이전에는 `push` 리스너가 없었다.
- manifest: `start_url:./index.html`, `scope:./`, standalone. Pages `/4me/` 아래 기존 SW 범위를 유지한다.
- `cloud.js`: 이메일 확인 Firebase Auth, `users/{uid}/planner/current` 전체 스냅샷 동기화. 사진은 기존 로컬 저장 방식 유지. 푸시는 서버에 확정된 최신 기록만 사용한다. 오프라인/충돌/동기화 중지 상태에서 변경한 예약은 서버 반영 전까지 변경되지 않는다.

## 구현 상세 및 배포 순서

서버 API, 중복·재시도, 기기 관리, 검증 결과와 승인 후 운영 절차는 다음과 같다.


### 앱·Service Worker

- `push.js`: 기기 연결 버튼 클릭에서만 권한을 요청한다. iPhone/iPad의 홈 화면 설치 안내, 지원 여부/차단된 권한 안내, 시간대 입력, 서버 테스트·오류 표시, 계정의 기기 목록·개별 해제를 제공한다. 테스트 성공은 **푸시 서비스의 접수**이며 실제 기기 수신 확인으로 표현하지 않는다.
- `push-storage.js`: 별도 `harugyeol-push` IndexedDB에 현재 기기의 계정 바인딩과 중복 방지 태그만 저장한다. 기존 사진 DB와 플래너 저장소는 교체하지 않는다.
- `push-worker.js`: `push`, `notificationclick`, `pushsubscriptionchange`를 기존 SW에서 불러온다. 계정·기기·만료를 검증하고 IndexedDB 트랜잭션으로 같은 태그를 중복 표시하지 않는다. 로그아웃/다른 계정의 알림은 표시하지 않는다. 클릭은 `/4me/index.html` 안의 허용된 화면/날짜만 연다. 기존 창에는 메시지를 전달하며 작성 중 모달을 닫기 전 확인한다.
- `cloud.js`: 현재 로그인 계정의 ID 토큰을 메모리에서만 가져오는 제한된 인증 연결을 추가했다. 토큰을 localStorage/백업/서버 구독 문서에 저장하지 않는다. 알림 사용을 끄거나 명시적으로 로그아웃할 때 이 기기 서버 구독 해제 후 로컬 바인딩을 끄고 브라우저 구독을 해제한다. 인증 종료·계정 변경 시에도 로컬 수신을 차단한다. 오프라인 서버 해제 실패는 안내하며, 브라우저 구독 해제와 서버의 404/410 처리·만료로 정리한다.
- 서버 구독이 활성화된 기기에서는 기존 화면의 주기 발송을 중지하여 이중 알림을 막는다. 서버 통신 장애 때 자동으로 로컬 발송을 다시 켜 중복을 만들지 않는다. 필요하면 기기 연결을 해제하고 기존 방식으로 돌아갈 수 있다.
- 일정은 기존 `reminderMinutes`, 습관은 기존 `reminderTime`을 사용한다. 투두에 선택 필드 `reminderTime`을 추가했다. 마감일이 있어야 저장하며 지정한 마감일/시각에 알린다. 기존 투두에는 값을 자동 추가하지 않는다. 완료·취소·이월·명시적 미진행 X·완료된 카테고리의 투두는 제외한다.
- `functions/reminder-model.js`는 브라우저와 서버가 공유한다. 기존 반복/발생 항목/건너뛰기/수정 예외를 처리하며, 기존 화면의 결과와 40개 날짜를 비교했다. 일기·사진은 예약 계산 대상이 아니다.
- 시간대는 기기별 IANA 이름으로 선택한다. 최초값은 브라우저 시간대다. DST 없는 시각은 건너뛰고, 가을에 두 번 존재하는 시각은 먼저 오는 시각 한 번을 기준으로 한다. 일정 사전 알림은 실제 경과 분을 빼 계산한다.

### 서버

- `functions/index.cjs`: Functions 2세대 `pushApi`(HTTPS)와 `sendScheduledPush`(매분) 두 개를 정의한다. 배포된 상태가 아니다.
- `/register`, `/status`, `/devices`, `/disable`, `/test`: Firebase Admin의 **취소 검사 포함 ID 토큰 검증**과 이메일 확인을 거친다. 요청 본문의 uid는 사용하지 않는다. 기기 조회·해제·테스트 모두 인증된 uid가 소유한 문서에만 허용한다. 목록에서 endpoint/암호화 키는 반환하지 않는다.
- `/health`는 공개 VAPID 키만 반환한다. 비밀 VAPID 키는 Secret Manager에서만 읽는다. 사용자별 분당 API 요청 30개·테스트 2개, 계정당 활성 기기 10개를 제한한다. 전송 endpoint는 알려진 Apple/Google/Mozilla/Microsoft HTTPS Push Service만 허용해 서버의 임의 URL 접근을 막는다. CORS는 현재 Pages origin만 허용한다.
- 구독은 30일 임대이며 앱 재방문 시 만료 7일 전부터 갱신한다. 구독 변경·만료 시 사용자에게 재연결을 요구하며, Service Worker가 몰래 인증을 복원하지 않는다. 만료 구독, 삭제/정지된 계정, 인증 강제 취소, 404/410 endpoint는 비활성화/정리한다.
- 스케줄러는 활성 기기를 25개씩 조회하고 사용자별 최신 Firestore 스냅샷을 읽는다. 발송 직전 트랜잭션에서 **기기 활성 상태와 스냅샷 revision을 다시 검증**한다. 스캔 중에 기록을 수정/삭제했다면 이전 예약을 보내지 않고 다음 회차에서 새 기록으로 계산한다. 이미 Push Service에 접수된 메시지를 나중에 회수하는 것은 보장할 수 없다.
- 함수 동시 실행 임대 + 기기/예약 태그별 전송 임대로 Scheduler 중복 호출을 막는다. 1분 단위이고 네트워크·OS에 따라 지연될 수 있으며 정확한 알람 시계가 아니다.
- 최근 10분을 확인하므로 잠깐의 서버 장애는 따라잡는다. 최대 3회 발송 시도, 일시적 네트워크 오류/408/429/5xx에 1분·2분 간격 재시도, 비일시적 4xx는 종료한다. SDK의 요청 타임아웃은 15초, Push Service 보관 TTL은 최대 10분이다. 10분보다 오래된 서버 미발송 알림은 뒤늦게 대량 발송하지 않는다.
- 서버 중복 기록은 하루 뒤 정리하며, 구독/요청 제한 기록도 만료 시 스케줄러에서 제한된 묶음으로 삭제한다. Firestore TTL 활성화나 인덱스/규칙 변경은 실행하지 않았다. 새로운 최상위 컬렉션 `pushDevices`, `pushDeliveries`, `pushRateLimits`, `pushControl`은 **기존 보안 규칙의 기본 거부**에 따라 클라이언트 직접 접근이 금지되며 Admin 함수만 다룬다.
- 사용량 보호를 위해 회차당 처리 시간을 약 50초로 제한하고 다음 기기 위치를 저장한다. 대규모 서비스용 큐가 아니며 사용자가 늘어 처리 지연이 10분에 가까워지면 큐/예약 색인을 별도로 도입해야 한다. 재시도와 서버·기기 중복 방지는 적용했지만, 외부 Push Service와 Firestore를 하나의 원자적 거래로 묶을 수 없어 수신/표시의 절대적인 exactly-once를 보장하지 않는다.
- 로그에는 전송 상태·오류 코드·축약 기기 식별자만 남긴다. endpoint·키·토큰·일정 본문은 기록하지 않는다.

### 승인 후에만 수행할 배포 절차

1. Firebase/GCP 콘솔에서 프로젝트 `harugyeol-e7866`의 현재 요금제, Firestore 리전, 최신 가격 및 예산 경보를 확인한다. 사용자 승인 후 필요한 Blaze 연결/Functions·Cloud Scheduler·Secret Manager·Build/Artifact Registry 관련 API를 설정한다. 기존 Firestore DB/규칙/사용자 데이터는 재생성하지 않는다.
2. Node 22와 Firebase CLI로 로그인할 프로젝트 관리 권한을 준비한다. 런타임 서비스 계정에는 필요한 Firestore 읽기·쓰기, Firebase Auth 사용자 조회 및 해당 비밀 키 접근 권한만 부여한다. `functions/index.cjs`의 실행 리전은 `asia-northeast3`이므로 기존 DB와 다르면 비용·지연을 확인한다.
3. 저장소에서 `npm ci --prefix functions --ignore-scripts`를 실행한다. 잠금 파일을 유지한다. 간접 의존성의 알려진 glob 취약점을 피하기 위해 `rimraf:^6.1.4` override를 적용했으며 설치 의존성 감사 결과는 아래에 기록한다.
4. `node functions/tools/create-vapid.cjs`로 키를 만든다. 이 도구는 공개키와 **권한 0600의 임시 비밀 키 파일 경로만** 출력한다. 비밀 키 값은 출력하지 않으며 저장소에 쓰지 않는다. VAPID 공개키는 비밀이 아니고 프런트엔드에 공개할 수 있다.
5. 승인된 프로젝트에 `firebase functions:secrets:set WEB_PUSH_PRIVATE_KEY --data-file <위 임시 파일> --project harugyeol-e7866`로 비밀 키를 등록한다. 등록 확인 후 임시 파일을 삭제한다. **생성한 키와 비밀 파일/서비스 계정 JSON을 GitHub에 올리지 않는다.**
6. Git에서 제외된 `functions/.env.harugyeol-e7866`에 공개 `WEB_PUSH_PUBLIC_KEY`와 실제 운영 연락처 `WEB_PUSH_SUBJECT=mailto:...`를 지정한다. `WEB_PUSH_SUBJECT`에는 예시 주소 대신 관리자가 수신할 수 있는 주소를 사용한다.
7. 로컬 검사 후 `firebase deploy --only functions:push --project harugyeol-e7866`을 실행한다. 이 명령은 새 함수와 Scheduler를 실제 생성하므로 **승인 전 실행 금지**다. 기존 planner/backups 보안 규칙은 배포 대상으로 포함하지 않았다. Functions 명령이 요구하는 IAM/API 변경도 승인 범위에 포함되는지 확인한다.
8. `/health`와 인증된 API를 운영 검증한 뒤 `push-config.json`에 실제 HTTPS `pushApi` URL을 넣고 `enabled:true`로 변경한다. 현재 Pages origin을 유지한다. 별도 도메인을 쓰면 서버 CORS를 함께 변경한다. Service Worker 캐시 버전을 올려 GitHub Pages에 배포한다.
9. 각 기기에서 로그인·자동 동기화·기존 알림 사용을 켜고 카테고리/항목별 시각을 선택한 뒤 이 기기를 연결한다. iPhone/iPad는 iOS 16.4 이상, 공유 → 홈 화면에 추가 후 설치 앱에서 버튼을 눌러 허용한다. 집중 모드·OS 알림 허용과 인터넷 연결도 확인한다.
10. 아래 실기기 행렬을 수행한 뒤 종료 상태 알림을 운영 완료로 판정한다. 문제가 있으면 기기 연결을 해제하고 Scheduler를 중지한다. 로컬 플래너 기록은 초기화하지 않는다. VAPID 키를 교체하면 기존 구독을 재연결해야 한다.

## 테스트 결과와 남은 검증

- Functions Node 테스트 14개: 예약 시각/자정/7일 사전 알림, 수정·삭제·비활성화, 투두 상태/반복 예외, 습관 체크 이력, IANA/DST, 10분 복구, Firestore 키 복원, 토큰/이메일/CORS/다른 사용자 차단, 두 기기/재실행 중복/재시도/410 정리/강제 인증 취소, 스캔 후 revision 변경 차단. Admin/Auth/Firestore/Push Service는 모형이며 실제 서버 왕복으로 보고하지 않는다.
- Service Worker 모형 검사 4개: 페이지가 없는 처리, 원자적 중복 표시 차단, 표시 실패 재시도, 계정·기기·만료 검증, 알림 클릭의 범위/날짜/포커스, 구독 변경 차단. 실제 OS 수신을 증명하는 검사가 아니다.
- `tools/push-notifications.test.cjs`: Chromium에서 서버 미설정 상태, 사용자 버튼 외 권한 요청 없음, 연결/시간대/테스트/실패/다른 기기 해제, 화면 알림과 중복 방지, 선택 투두 마감 시각 저장/기존 필드 유지, 알림 날짜 이동/작성 중 확인, iPhone 설치 안내, 320/390/1440 라이트·다크를 검사했다. 구독과 서버 API는 모형이다.
- `tools/push-reminder-parity.test.cjs`: 기존 화면 모델과 서버 공유 모델을 40개 날짜의 일정·투두·습관 및 알림 결과로 비교했다.
- 기존 `expanded-repeat-reminders`, `login-entry`, `cloud-field-validation`, `bug-audit-regressions`, `todo-deadline`, `home-dashboard`, `design-completion` 검사를 통과했다. 오래된 마감일 검사에서 반복 설정 바로 앞 요소와 홈에 마감일·완료 투두를 노출하던 기대를 현재 UI 요구에 맞췄으며, 완료 묶음 대신 개별 카테고리를 검사하는 지원 옵션을 명시했다. 기존 실제 Chromium Service Worker의 `showNotification` 경로도 검사했다.
- 로컬 실행 환경 Node 24와 배포 대상 Node 22에서 서버 검사를 실행한다. 정적 프로젝트이므로 별도 프런트엔드 빌드는 없다. JavaScript 구문·SDK 로드·`git diff --check`를 확인한다.
- `npm audit --omit=dev --prefix functions`: 알려진 취약점 0건. 설치 시 런타임이 Node 24라는 경고가 있었으나 배포 대상 Node 22.23.4에서도 서버 검사 14개를 통과했다.
- **미검증:** 실제 Functions/Scheduler 배포, 실제 계정의 서버 Push Service 발송, iPhone/Android 실기기 실행·백그라운드·종료·잠금 상태, 실기기 권한 거부/네트워크 복구, 실제 동일 계정의 여러 기기 수신. 모두 승인 및 배포 후 검사 대상이다.

실기기 검증 순서: 일정/투두 마감/습관을 각각 3~5분 뒤로 지정 → 동기화 완료 확인 → 서버 테스트 수신 → 앱 실행/다른 앱으로 전환/창 종료/화면 잠금에서 각 1회 수신과 클릭 날짜 확인 → 시각 변경/삭제/완료 후 이전 시각 미발송 확인 → 권한 거부 및 설정 복구 → 네트워크 잠깐 차단 후 TTL 내 복구 → 같은 계정 두 기기에서 각각 한 번 → 한 기기 해제·로그아웃 후 다른 기기만 수신. 강제 종료나 집중 모드 등 OS 정책에 따른 수신 제한도 기록한다.

## 데이터와 파일

기존 localStorage/IndexedDB/Firestore 스냅샷 및 JSON 백업 구조를 교체하지 않았다. 투두의 선택 `reminderTime`만 기존 객체에 추가되며 전체 스냅샷/JSON에 함께 보존된다. 기기 endpoint·암호화 키·비밀 키는 플래너 JSON 백업에 들어가지 않는다. 일정·루틴의 기존 알림 값과 사진 저장 방식은 유지한다.

수정: `index.html`, `planner-enhancements.js`, `cloud.js`, `sw.js`.
추가: `push.js`, `push-storage.js`, `push-worker.js`, `push-config.json`, `firebase.json`, `functions/` 서버·공유 모델·잠금 파일·검사·키 생성 도구, 푸시 관련 `tools/*test.cjs` 및 기존 마감일 검사 갱신, `.gitignore`, 이 문서.

## Google Cloud Shell에서 실행하는 간단한 배포 경로

Codex 환경에 Google 관리 계정 연결이 없으면 사용자의 Cloud Shell에서 직접 배포할 수 있다. 이 경로는 Codex의 네트워크 제한을 우회해 원격 명령을 실행하는 기능이 아니다. 사용자가 본인 Google 계정의 Cloud Shell에서 아래 명령을 실행하며, 인증 코드·토큰·서비스 계정 JSON을 대화창으로 보내지 않는다.

1. https://shell.cloud.google.com/?project=harugyeol-e7866&show=terminal 에서 Cloud Shell을 연다. Authorize가 뜨면 본인 계정으로 승인한다.
2. 처음 실행할 때 다음 명령을 실행한다. 같은 이름의 폴더가 이미 있으면 기존 작업 폴더를 확인하고 그 안에서 배포 명령만 다시 실행한다. 폴더를 삭제하거나 덮어쓰지 않는다.

```bash
git clone https://github.com/zzyu-spec/4me.git harugyeol-push && cd harugyeol-push && bash tools/deploy-push-cloudshell.sh --deploy
```

이 `--deploy` 명령은 **실제** Functions/Scheduler/Secret/실행 계정을 만들고 필요한 API·권한을 설정한다. Blaze 사용량, 빌드·이미지·Secret 보관 비용이 발생할 수 있으며 0원이나 요금 상한을 보장하지 않는다. `--deploy`가 없으면 안내만 출력한다. 스크립트는 본인 Cloud Shell에서만 실행하도록 확인하고, 결제 연결 여부를 읽은 뒤 로컬 검사 18개를 거친다. ADC가 없다면 본인 Cloud Shell의 Google 로그인 절차를 요청하며 토큰 값을 수집·출력하지 않는다.

Node가 22 미만이면 임시 로컬 Node 22 도구를 설치한다. Firebase CLI 15.35.0을 사용한다. 전용 `harugyeol-push-runtime` 서비스 계정에 Datastore User와 Firebase Auth Viewer, 지정 Secret 한 개의 Secret Accessor를 부여한다. 실제 조회된 build SA에 Run Builder를 사용한다. 배포하는 계정에는 이 계정들에 대한 actAs만 부여하며 Owner/Editor를 새로 부여하지 않는다. `PUSH_RUNTIME_SERVICE_ACCOUNT`는 새로운 공개 Functions parameter다. SDK가 서버 실행 계정과 Scheduler OIDC 호출 계정에 이 값을 사용한다.

기존 VAPID Secret과 공개 설정은 재사용하며 키를 자동 교체하지 않는다. 기존 Secret이 있는데 공개 설정을 찾지 못하면 중단한다. 새 비밀 키는 0600 임시 파일에서 Secret Manager로 전송하고 삭제한다. 공개키·연락 URL·실행 계정만 Git 제외된 `.env`에 저장한다. 기존 사용자 기록과 Firestore 보안 규칙은 변경하지 않는다.

CLI가 함수 배포를 마친 뒤 이미지 정리 정책 미설정만으로 오류를 반환하는 경우에는 그 정확한 메시지를 구분한다. 기존 저장소의 이미지 삭제 정책을 임의로 바꾸지는 않고 보관 비용 가능성을 알린다. 다른 배포 오류는 성공으로 처리하지 않는다. 이후 두 함수의 ACTIVE 상태와 실제 실행 계정, Scheduler ENABLED 상태와 OIDC 계정, `/health`의 버전·공개키 일치까지 검사해야 `HARUGYEOL_PUSH_DEPLOYED`를 출력한다.

앱의 `push-config.json`은 `enabled:false`를 유지하되, 고정된 하루결 서버의 `discoveryApiBase`를 제공한다. 앱 시작 때 공개 `/health`를 한 번 확인하고 올바른 버전·공개키가 응답할 때에만 이 기기 연결 UI를 활성화한다. 서버 미배포/오류/잘못된 키는 기존 실행 중 알림 모드를 유지한다. 이 공개 확인은 배포 후 함수 요청량에 포함될 수 있다. 권한은 자동 요청하지 않는다. API 응답은 서버 전체 예약의 성공 증명이 아니므로, 위 스크립트 완료와 기기 테스트를 별도로 확인한다.

서버 확인이 끝나면 iOS 16.4 이상 홈 화면의 하루결을 최신 버전으로 새로고침한 뒤 종 아이콘에서 **알림 사용과 대상·시각 저장 → 이 기기 알림 연결 → 서버 테스트 알림**을 실행한다. 앱을 닫거나 화면을 잠근 상태의 실제 수신은 사용자가 기기에서 확인해야 한다.

Cloud Shell 배포 스크립트의 변경 방지·키 재사용·프로젝트 고정은 외부 명령 모형으로 검사했고, 자동 서버 발견의 성공/실패/키 오류/호스트 검증은 브라우저 모형으로 검사했다. 이 환경에서 실제 Google Cloud Shell 배포나 실제 휴대폰 수신을 검증했다고 주장하지 않는다.
