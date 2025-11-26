# GPT Realtime Mini 템플릿

이 프로젝트는 Next.js App Router 기반으로 OpenAI Realtime API + `gpt-realtime-mini` 모델을 빠르게 붙일 수 있도록 구성한 최소 템플릿입니다. UI, 서버, 에이전트 SDK 래퍼를 포함하고 있기 때문에 다른 프로젝트에 복사해서 바로 사용할 수 있습니다.

## 빠른 시작

1. 의존성 설치:
   ```bash
   npm install
   ```
2. `.env.example`을 복사해서 `.env`를 만들고 `OPENAI_API_KEY`에 서버용 API 키를 설정합니다.
   ```bash
   cp .env.example .env
   ```
3. 개발 서버 실행:
   ```bash
   npm run dev
   ```
   브라우저에서 `http://localhost:3000`에 접속하면 데모 UI를 확인할 수 있습니다.

## 환경 변수

- `OPENAI_API_KEY`: Realtime client secret을 발급할 때 서버에서만 사용하는 키입니다. 외부에 노출되면 안 됩니다.
- `REALTIME_MODEL`: 기본 모델(`gpt-realtime-mini`)을 바꾸고 싶을 때 사용합니다.

## 주요 파일/디렉터리

- `app/api/session/route.ts`: OpenAI REST API를 통해 ephemeral client secret을 발급합니다. `real-time` 세션 구성(모델, 출력 modality)을 서버에서 정의하고 클라이언트에 전달합니다.
- `app/api/session/route.ts`: OpenAI REST API를 통해 ephemeral client secret을 발급합니다. 세션 config 에서 `gpt-realtime-mini` 모델, `audio` 출력모달리티, `voice: marin` 오디오, 그리고 VAD 설정(`threshold`/`prefix_padding_ms`/`silence_duration_ms`)을 맞추므로 필요시 여기에서 손쉽게 조정할 수 있습니다. 서버/클라이언트 모두 기본 instructions를 한국어 전용 응답으로 명시해두었기 때문에 시스템 프롬프트로 한국어만 쓰도록 모델에게 안내됩니다.
- `src/lib/realtimeClient.ts`: `RealtimeSession`/`RealtimeAgent`를 감싼 재사용 가능한 클라이언트 래퍼입니다. `connect`, `disconnect`, `sendText`, `startMic`, `stopMic` 인터페이스와 이벤트 구독(`status`, `message`, `audio`, `error`)을 제공합니다.
- `src/components/RealtimeDemo.tsx`: 클라이언트 UI 컴포넌트로 상태 표시, 텍스트/마이크 입력, 응답 목록, 오디오 재생 버튼을 포함합니다.
- `app/page.tsx`: 위 데모 컴포넌트를 동적 import로 로드하는 메인 페이지입니다.
- `app/layout.tsx` + `app/globals.css`: 전체 레이아웃과 기본 스타일을 담당합니다.
- `package.json`, `tsconfig.json`, `next.config.js`: Next.js 앱을 작동시키는 설정 및 스크립트입니다.

## 복사해서 재사용 시 가져갈 파일 목록

필요한 파일을 통째로 다른 프로젝트에 붙여넣을 때:

1. `app/api/session/route.ts`
2. `src/lib/realtimeClient.ts`
3. `src/components/RealtimeDemo.tsx`
4. `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
5. `.env.example` (`OPENAI_API_KEY`, `REALTIME_MODEL` 설정)
6. `package.json`, `tsconfig.json`, `next.config.js`

이외에 `node_modules`/`package-lock.json`은 재설치하면 됩니다.

## 구조 트리

```
.
├── app
│   ├── api/session/route.ts
│   ├── globals.css
   ├── layout.tsx
   └── page.tsx
├── src
│   ├── components
│   │   └── RealtimeDemo.tsx
│   └── lib
│       └── realtimeClient.ts
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

## 운영/확장 팁

1. 클라이언트에서 사용하는 모델을 바꾸려면 `real-time` 세션을 생성하는 `SESSION_ENDPOINT` 또는 `REALTIME_MODEL` 상수를 변경하면 됩니다.
2. UI에서 더 많은 이벤트(예: 함수 호출, guardrail 등)를 보고 싶다면 `RealtimeClient`에 이벤트 리스너를 추가하면 됩니다.
3. 배포 시 `OPENAI_API_KEY`를 안전한 서버 환경 변수로 등록하고, 클라이언트에서는 `/api/session`만 호출하도록 합니다.
