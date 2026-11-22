# web-push-poc

FCM 가입 없이 Bun 서버에서 웹 푸시 알림을 보낼 수 있는지 검증하는 최소 예제다.

## 무엇을 검증하나

`web-push` 라이브러리가 구현하는 Web Push 프로토콜을 끝에서 끝까지 확인한다.

| 단계 | 용어 | 하는 곳 |
| --- | --- | --- |
| 1 | VAPID 키 쌍 생성 (ECDSA P-256) | `scripts/generate-keys.ts` |
| 2 | 푸시 구독 (`PushManager.subscribe`) | `public/app.js` |
| 3 | VAPID 서명 (ES256 JWT, RFC 8292) | `server.ts` → `web-push` |
| 4 | 메시지 암호화 (aes128gcm, RFC 8291) | `server.ts` → `web-push` |
| 5 | 푸시 서비스로 전송 (RFC 8030) | `server.ts` → `web-push` |
| 6 | `push` 이벤트 수신과 알림 표시 | `public/sw.js` |
| 7 | `notificationclick`으로 앱 열기 | `public/sw.js` |

## 실행

```bash
bun install
```

```bash
bun run keys
```

```bash
bun run dev
```

`http://localhost:3000`을 열고 구독 → 테스트 알림 보내기 순서로 누른다. 발송 결과가 201이면 푸시 서비스가 메시지를 받은 것이다.

## 휴대폰에서 확인

휴대폰은 https 주소가 필요하다. 터널이나 배포 주소로 연다.

- Android Chrome: 브라우저에서 바로 구독할 수 있다
- iPhone: Safari에서 홈 화면에 추가한 뒤 그 앱으로 열어야 구독할 수 있다

## 제약

- 구독은 서버 메모리에만 둔다. 서버를 다시 켜면 사라지고, "테스트 알림 보내기"를 누를 때 페이지가 다시 등록한다
- `.env`에는 VAPID 비공개 키가 들어 있으므로 커밋하지 않는다
