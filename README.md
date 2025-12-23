> https://slack-rag-bot-console.vercel.app 에 접속하여 바로 사용해보실 수 있습니다.

# AI-Powered Slack Bot

AI를 활용한 인텔리전트 Slack 봇으로, GitHub 코드베이스와 Notion 문서를 검색하여 질문에 답변하는 시스템입니다.

## 🎯 주요 기능

- **🤖 AI 기반 질문 분류**: 사용자 질문을 자동으로 분석하여 적절한 서비스로 라우팅
- **📚 Notion 문서 검색**: 업무 프로세스, 가이드라인, 정책 문서를 Pinecone 벡터 검색으로 조회
- **💻 GitHub 코드 검색**: 코드베이스, 기술 문서, API 문서를 벡터 검색으로 탐색
- **💬 일반 대화**: ChatGPT 기반의 자연스러운 대화 지원
- **🔄 자동 임베딩 업데이트**: 30분마다 최신 GitHub 변경사항을 자동으로 반영
- **🏢 멀티 테넌트 지원**: 여러 조직의 독립적인 설정 관리

## 🏗️ 시스템 아키텍처

### 핵심 구성 요소

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Slack Events  │───▶│  AppController   │───▶│   AppService    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                               ┌─────────────────────────────────────┐
                               │        LangGraph Router             │
                               │    (Question Classification)        │
                               └─────────────────────────────────────┘
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
           ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
           │ Conversation    │ │  Notion Service │ │ GitHub Service  │
           │    Service      │ │                 │ │                 │
           └─────────────────┘ └─────────────────┘ └─────────────────┘
                     │                  │                  │
                     ▼                  ▼                  ▼
           ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
           │    ChatGPT      │ │ Pinecone Vector │ │ Pinecone Vector │
           │   (OpenAI)      │ │   (Notion DB)   │ │  (GitHub DB)    │
           └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 데이터 플로우

1. **Slack 이벤트 수신**: 사용자 메시지가 Slack을 통해 봇에 전달
2. **질문 분류**: LangGraph와 OpenAI를 사용하여 질문 유형 자동 분류
   - `conversation`: 일반 대화
   - `notion`: Notion 문서 검색
   - `github`: GitHub 코드 검색
3. **적절한 서비스 라우팅**: 분류 결과에 따라 해당 서비스 호출
4. **벡터 검색 및 응답 생성**: Pinecone을 통한 관련 문서 검색 후 AI 답변 생성
5. **Slack 응답**: 생성된 답변을 Slack 스레드에 전송

## 🛠️ 기술 스택

### Backend Framework
- **NestJS**: TypeScript 기반의 프로그레시브 Node.js 프레임워크
- **TypeScript**: 정적 타입 검사를 위한 JavaScript 확장

### AI & ML
- **LangChain**: AI 애플리케이션 개발 프레임워크
- **LangGraph**: 복잡한 AI 워크플로우 관리
- **OpenAI GPT**: 자연어 처리 및 텍스트 생성
- **Pinecone**: 벡터 데이터베이스 및 유사성 검색

### 통합 서비스
- **Slack Web API**: Slack 워크스페이스 통합
- **GitHub API**: 리포지토리 및 코드 접근
- **Notion API**: 페이지 및 데이터베이스 조회

### 데이터베이스 & ORM
- **Prisma**: 타입 안전한 데이터베이스 ORM
- **MySQL**: 관계형 데이터베이스

### 스케줄링
- **@nestjs/schedule**: Cron 작업 스케줄링

## 📦 설치 및 설정

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd slack-bot
```

### 2. 의존성 설치
```bash
# Node.js 의존성 설치
npm install

# Python 의존성 설치 (임베딩 스크립트용)
pip install -r requirements.txt
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 변수들을 설정:

```env
# 데이터베이스
DATABASE_URL="mysql://username:password@localhost:3306/database_name"

# OpenAI
OPENAI_API_KEY="your_openai_api_key"

# Pinecone
PINECONE_API_KEY="your_pinecone_api_key"
PINECONE_INDEX_NAME="your_pinecone_index"

# Slack
SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
SLACK_SIGNING_SECRET="your_slack_signing_secret"

# API 키 (선택사항)
API_KEY="your_api_key_for_embedding_endpoints"

# 서버 포트
PORT=3000
```

### 4. 데이터베이스 설정
```bash
# Prisma 마이그레이션 실행
npx prisma migrate dev

# Prisma 클라이언트 생성
npx prisma generate
```

### 5. Pinecone 인덱스 설정
Pinecone 콘솔에서 벡터 인덱스를 생성하고 환경 변수에 설정합니다.

## 🚀 실행 방법

### 개발 모드
```bash
npm run start:dev
```

### 프로덕션 모드
```bash
# 빌드
npm run build

# 실행
npm run start:prod
```

### 테스트
```bash
# 단위 테스트
npm run test

# E2E 테스트
npm run test:e2e

# 테스트 커버리지
npm run test:cov
```

## 📊 임베딩 관리

### GitHub 임베딩 업데이트
```bash
# 초기 임베딩 생성 (API 호출)
curl -X POST http://localhost:3000/github-embedding/init \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{"tenantId": "your_tenant_id"}'

# 자동 업데이트는 1시간마다 실행됩니다
```

### Notion 임베딩 업데이트
```bash
# 초기 임베딩 생성 (API 호출)
curl -X POST http://localhost:3000/notion-embedding/init \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{"tenantId": "your_tenant_id"}'

# 자동 업데이트는 1시간마다 실행됩니다
```

## 🔧 API 엔드포인트

### Slack 이벤트
- `POST /`: Slack 이벤트 수신 엔드포인트

### GitHub 임베딩
- `POST /github-embedding/init`: GitHub 리포지토리 전체 임베딩 초기화

### Notion 임베딩
- `POST /notion-embedding/init`: Notion 데이터베이스 전체 임베딩 초기화

## 📁 프로젝트 구조

```
slack-bot/
├── src/
│   ├── app/               # 앱 메인 모듈
│   ├── conversations/     # 일반 대화 서비스
│   ├── embedding/         # 임베딩 관리 (GitHub, Notion)
│   ├── github/           # GitHub 통합 서비스
│   ├── notion/           # Notion 통합 서비스
│   ├── @types/           # TypeScript 타입 정의
│   └── constants.ts      # 공통 상수 정의
├── prisma/
│   ├── schema.prisma     # 데이터베이스 스키마
│   └── migrations/       # 데이터베이스 마이그레이션
├── slack/                # Slack 클라이언트 모듈
├── model/                # AI 모델 설정
├── pinecone/             # Pinecone 벡터 DB 설정
└── test/                 # 테스트 파일
```

## 🔑 주요 컴포넌트

### AppService
- LangGraph를 사용한 질문 분류 및 라우팅
- 각 서비스로의 요청 전달 및 응답 통합

### GithubEmbeddingService
- GitHub 리포지토리 파일 스캔 및 임베딩
- 지원 파일 확장자 필터링
- 변경된 파일만 선택적 업데이트

### NotionEmbeddingService
- Notion 페이지 및 데이터베이스 임베딩
- 페이지 내용 추출 및 벡터화

### ConversationsService
- 일반 대화를 위한 ChatGPT 연동

## 🔒 보안 고려사항

- API 키 기반 인증 (임베딩 엔드포인트)
- 환경 변수를 통한 민감한 정보 관리
- 멀티 테넌트 데이터 격리

## 📈 모니터링 및 로깅

- 각 서비스별 상세 로깅
- 에러 처리 및 Slack 알림
- 임베딩 업데이트 상태 추적

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

---

**주의**: 실제 사용 전 모든 API 키와 환경 변수를 올바르게 설정했는지 확인하세요.
