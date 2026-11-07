# 4me

세 서비스의 원본 파일을 서비스별로 관리합니다. Firebase 프로젝트·인증·DB·보안 규칙·사용자 데이터는 이번 폴더 정리로 변경하지 않습니다.

| 폴더 | 내용 | 기존 배포 주소 |
| --- | --- | --- |
| `harugyeol/` | 하루결, 가계부(`ledger/`), 알림 서버(`functions/`), 관련 문서·개발 도구 | `/4me/`, `/4me/ledger/` |
| `arnit/` | 아르닛(기존 `taste-drawer/`) | `/4me/taste-drawer/` |
| `damrok/` | 담록 | `/4me/damrok/` |
| `shared/` | 공통 Firebase SDK 번들, SDK 고지, 공개 웹 설정 | 기존 루트 파일 주소 |
| `scripts/` | 전체 사이트 빌드·구조 검증 | 배포하지 않는 개발 도구 |

## 로컬 확인

Node.js 22 이상에서 저장소 루트에서 실행합니다. npm 설치는 필요 없습니다.

```sh
node --test scripts/build-site.test.mjs
python3 -m http.server 8000 --directory _site
```

하루결은 http://localhost:8000/ , 아르닛은 http://localhost:8000/taste-drawer/ , 담록은 http://localhost:8000/damrok/ 에서 확인합니다.
원본 폴더를 직접 웹 루트로 서빙하지 않습니다. 기존 상대 경로는 빌드 결과를 기준으로 동작합니다.

## 기존 테스트·배포 도구

`node scripts/build-site.mjs`로 기존 파일 구조를 `_site/`에 재현한 후, 기존 테스트와 문서에 있는 명령은 `cd _site` 후 실행합니다.
예: `cd _site && node --test tools/*.test.cjs tools/*.test.mjs functions/test/*.test.cjs`.
브라우저 테스트도 `_site/`에서 실행하며 Playwright 설치가 별도로 필요합니다.
알림 서버 배포는 실제 백엔드를 변경하는 기존의 명시적 `--deploy` 명령입니다. 폴더 정리·빌드·Pages 배포 과정에서는 실행하지 않습니다.
기존 문서 속 저장소 경로는 이동 전 경로일 수 있으므로 위 표의 원본 폴더에서 찾으세요.

## GitHub Pages

루트 파일을 그대로 배포하던 방식에서 Actions 빌드 결과를 배포하는 방식으로 바뀝니다.
**이 변경을 main에 합치기 전**, 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택해야 합니다.
PR에서는 빌드와 회귀 테스트만 실행하고, main에 합친 후 같은 결과물로 배포합니다.
기존 서비스 URL과 서비스 워커 범위는 유지하며 리디렉션이나 브라우저 데이터 이동은 하지 않습니다.
