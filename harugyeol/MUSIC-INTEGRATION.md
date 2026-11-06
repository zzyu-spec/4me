# 오늘의 노래 연동

2026-10-30 기준 구현 기록. 이 기능은 음악 **검색·메타데이터 저장·원곡 페이지 링크**만 제공합니다. 음원 재생, 미리 듣기, 다운로드, 크롤링, 비공식 API는 사용하지 않습니다.

## 현재 제공하는 기능

| 서비스 | 제공 방식 | 필요한 설정 |
| --- | --- | --- |
| Apple Music / iTunes | 공식 iTunes Search API의 `entity=song` 검색, 결과 선택. 한국 스토어, 최대 25개 결과. 원본이 제공한 서비스 URL과 이미지 URL 사용. | API 키·Client Secret·별도 서버 불필요 |
| Spotify | 공식 사이트에서 곡 찾기 링크 + 곡 URL·제목·가수·앨범·선택적 커버 URL 수동 입력 | 없음. Spotify API 자동 검색은 연결하지 않음 |
| SoundCloud | 공식 사이트에서 곡 찾기 링크 + 같은 수동 입력 | 없음. SoundCloud API 자동 검색은 연결하지 않음 |
| Melon | 공식 사이트에서 곡 찾기 링크 + 같은 수동 입력 | 없음. 허가된 검색 API를 확인하지 못해 자동 검색은 연결하지 않음 |

검색 서비스 필터에 자동 검색과 링크 입력 방식을 구분해 표시합니다. 각 서비스는 독립적이라 한 서비스의 API 오류가 다른 서비스의 링크 저장을 막지 않습니다. iTunes 오류 시에도 직접 링크 입력을 사용할 수 있습니다. 링크 입력은 그 서비스의 HTTPS 호스트만 허용합니다. 사용자가 입력한 곡 정보는 해당 서비스에서 검증된 데이터라고 표시하지 않습니다.

## 공식 자료 확인 범위와 제한

다음 공식 주소에 접근을 시도했으나, **실행 환경의 네트워크 프록시가 모두 HTTP 403으로 차단**했습니다. 따라서 아래 OAuth 개요는 구현 방식을 정하기 위한 기존 공식 프로토콜 지식이며, **현재의 개발자 등록 승인·요금제·사용자 수·이미지 이용 조건·API 정책을 새로 확인했다고 주장하지 않습니다.** 실제 iTunes 서버 응답도 이 환경에서는 받지 못했습니다. 브라우저 검증은 공식 응답 형식을 모사한 테스트이며 실제 서비스 연결 성공과 구분합니다.

- [Apple iTunes Search API: Searching](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html)
- [Apple iTunes Search API: 개요·이용 조건](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- [Spotify: Authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization)
- [Spotify: Authorization Code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [SoundCloud: 공식 API 가이드](https://developers.soundcloud.com/docs/api/guide)
- Melon 개발자 도메인(`https://developers.melon.com/`) 접근도 차단돼 공개 검색 API나 허가를 확인하지 못했습니다. API가 절대로 존재하지 않는다는 의미는 아닙니다. 공개 사이트의 내부 요청을 API로 사용하지 않습니다.

Spotify API를 추가하려면 등록된 앱의 공개 Client ID, 허용된 HTTPS 리디렉션 주소, 현재 앱 접근 자격 및 사용자 인증 범위를 먼저 확인해야 합니다. 브라우저용 PKCE는 Client Secret 없이 설계할 수 있지만 로그인·승인·토큰 갱신·계정 분리까지 별도 구현해야 합니다. 이번에는 사용자 인증을 흉내 내거나 임의의 토큰을 제공하지 않습니다.

SoundCloud는 승인된 앱의 OAuth 자격 증명과 현재 토큰 발급·검색 권한 조건 확인이 선행돼야 합니다. Client Secret이 필요한 흐름은 GitHub Pages에 넣을 수 없습니다. Melon도 공식 허용 수단·제휴 자격을 확보하기 전에는 API 연동을 활성화하지 않습니다.

## GitHub Pages와 검색 요청

- `music.js`, `music.css`를 같은 디렉터리에서 로드합니다. 현재 제공 기능에는 서버·환경 변수·비밀키가 필요 없습니다.
- iTunes의 공식 JSONP `callback` 방식으로 검색합니다. HTTPS `https://itunes.apple.com/search`만 호출하며, 쿼리는 `URLSearchParams`로 인코딩하고 콜백 이름은 앱이 생성합니다. 서드파티 JSONP는 해당 공식 응답을 스크립트로 실행하는 방식이므로 임의의 API 주소를 입력받지 않습니다.
- 검색은 사용자의 명시적 검색 버튼/Enter로만 실행합니다. 4초 요청 간격, 메모리 내 5분 검색 캐시(최대 24개), 결과 제한 25개를 적용합니다. 앱/브라우저별 제한이며 서비스 전체의 할당량을 보장하지 않습니다. 서비스가 제한하거나 실패하면 안내하고 수동 입력을 유지합니다.
- 15초 타임아웃, 창 닫기/필터 변경 시 취소, 늦게 도착한 응답 무시, 중복 정리, 로딩/빈 결과/오류 표시를 제공합니다. 창을 연 날짜·계정이 바뀌면 곡 저장을 거절합니다.
- API의 제목·가수·앨범명은 텍스트로 이스케이프합니다. `javascript:`, `data:`, 인증 정보가 담긴 URL 등을 곡 링크/커버로 사용하지 않습니다. 외부 링크는 `noopener noreferrer`를 사용합니다.
- CSP를 별도로 설정하는 경우 같은 출처의 스크립트 외에 `https://itunes.apple.com`의 JSONP 스크립트와 실제 앨범 이미지 호스트를 허용해야 합니다. CSP를 무작정 `*`로 넓히지 마세요.
- 서비스 워커 v151에 신규 정적 파일만 추가했습니다. 외부 음악 검색·커버 이미지를 SW에 저장하지 않습니다. 저장한 곡의 글 정보와 링크는 오프라인에도 보이지만, 처음 읽는 외부 커버 이미지는 인터넷이 필요할 수 있습니다. 이미지 실패 시 음악 아이콘이 남습니다.

향후 비밀키가 필요한 공식 API 접근을 확보한다면 Cloudflare Workers 등 서버리스 게이트웨이를 별도 배포할 수 있습니다. Secret은 서버리스 환경 변수에 두고, 허용 출처·API 주소 고정·사용량 제한·캐시 정책·서비스 약관을 적용해야 합니다. **현재 Worker 주소나 인증 연동은 배포하지 않았고, 키 입력칸이나 작동하지 않는 자동 연동 토글도 만들지 않았습니다.**

## 이미지·콘텐츠 사용

iTunes에서 받은 커버 URL을 변경·확대·Base64 변환하지 않고 곡 정보 옆에 표시하며, 검색 결과와 저장 카드에 iTunes 원곡 페이지 링크를 제공합니다. 자동 검색의 커버는 응답의 HTTPS `*.mzstatic.com` URL만 사용합니다. 직접 입력한 다른 서비스 커버는 사용자가 사용이 허용된 HTTPS 이미지 URL을 제공할 때만 표시하며, URL이 없거나 로드 실패 시 음악 아이콘을 보여 줍니다. 음원/preview URL은 저장하거나 요청하지 않습니다.

정책의 최신 원문 확인은 네트워크 제한 때문에 남아 있습니다. 공개 운영 시 위 공식 Apple 문서의 프로모션 콘텐츠·표시/링크·요청 제한 조건을 다시 확인하고, 서비스에서 요구하는 표시 조건이 달라졌다면 이에 맞게 조정해야 합니다. 링크가 있다고 해서 모든 서비스의 이미지 재사용 권한을 얻었다고 간주하지 않습니다. 커버 URL을 별도 이미지 수집·프록시 저장소로 복제하지 않습니다.

## 저장 구조와 과거 기록

기존 `state.journals[YYYY-MM-DD]` 안에 선택적 `song` 객체만 추가합니다.

```json
{
  "song": {
    "version": 1,
    "source": "itunes",
    "serviceName": "Apple Music / iTunes",
    "providerId": "곡 식별자",
    "title": "노래 제목",
    "artist": "아티스트",
    "album": "앨범",
    "artworkUrl": "https://…",
    "url": "https://music.apple.com/…"
  }
}
```

- `source`는 `itunes`, `spotify`, `soundcloud`, `melon` 중 하나이며 서비스 이름은 UI에서 매핑합니다. 수동 입력 곡은 `manual: true`입니다.
- 기존 일기의 다른 필드·사진·감정·회고·알 수 없는 필드를 보존합니다. 음악 변경 전 작성 중 일기를 먼저 자동 저장하고 음악 영역만 갱신해 입력·커서·스크롤을 불필요하게 리셋하지 않습니다.
- `song`이 아직 없으면 과거 `songTitle`, `songArtist`를 카드에 표시합니다. 새 곡 선택 시에도 과거 필드를 삭제하거나 덮어쓰지 않습니다. 삭제는 `song: null`로 기록해 옛 노래가 다시 나타나지 않게 하며, 예전 텍스트는 백업에 남습니다.
- localStorage `harugyeol-v1`, 전체 JSON 백업/복원, Firebase 텍스트 스냅샷은 객체 전체를 보존하므로 별도 마이그레이션이 필요 없습니다. 곡의 커버는 문자열 URL이며 일기 첨부 사진 배열에 넣지 않습니다.
- 저장 실패 시 음악 변경을 되돌리고 완료로 표시하지 않습니다. 선택/취소/삭제는 다른 날짜를 변경하지 않습니다.

## 검증

`HARUGYEOL_TEST_URL=http://127.0.0.1:8003 node tools/music-diary.test.cjs`

공식 iTunes 응답 형식의 모형을 사용해 검색, 중복·안전하지 않은 링크 제거, 결과 선택, 새로고침, 날짜별 분리, 과거 필드/현재 입력 보존, 네 서비스 링크 저장, 이미지 실패 대체, 오류/빈 결과/로딩/취소, 날짜 변경 중 저장 거절, 실제 JSON 파일 백업/복원, API 없이 저장 카드 표시, 320–1440px 라이트·다크 화면을 검사합니다. 테스트에서 실제 음원이나 실계정을 사용하지 않습니다.

**실제 iTunes API 통신과 아이폰 Safari 실기기 검증은 미완료**입니다. 네트워크가 허용된 배포 사이트에서 곡 검색→선택→재접속을 추가 확인해야 합니다. 모형을 통한 성공을 실제 네 서비스 API 연결 성공으로 해석하면 안 됩니다.
