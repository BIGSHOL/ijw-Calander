# 배포 가이드 (Deployment Guide)

## 환경 변수 설정

프로젝트를 빌드하고 배포하기 전에 **반드시** 환경 변수를 설정해야 합니다.

### 1. 환경 변수 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하세요:

```bash
# 프로젝트 루트 디렉토리에서
cp .env.local.example .env.local
```

### 2. 환경 변수 값 설정

`.env.local` 파일을 열어서 다음 값들을 실제 값으로 변경하세요:

#### ✅ **필수 설정**

##### Firebase 설정
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=ijw-calander.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ijw-calander
VITE_FIREBASE_STORAGE_BUCKET=ijw-calander.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

##### Supabase 설정 (진도 추적 기능에 필수)
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

> ⚠️ **중요**: Supabase 설정이 없으면 수학 시간표의 진도 정보가 표시되지 않습니다!

##### 암호화 키
```env
VITE_ENCRYPTION_KEY=your_encryption_key_here
```

##### 마스터 계정
```env
VITE_MASTER_EMAILS=your_master_email@example.com
```

#### 선택 설정

##### Gemini AI (선택사항)
```env
VITE_GEMINI_API_KEY=
```

### 3. 환경 변수 확인

`.env.local` 파일이 제대로 설정되었는지 확인:

```bash
# 파일이 존재하는지 확인
ls -la .env.local

# 파일 내용 확인 (민감한 정보 포함되어 있으므로 주의!)
cat .env.local
```

## 빌드 및 배포

### 빌드

```bash
npm run build
```

빌드가 성공하면 `dist` 폴더에 번들된 파일들이 생성됩니다.

### Firebase 배포

```bash
npx firebase deploy --only hosting
```

## 문제 해결

### "VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다" 에러

**원인**: `.env.local` 파일이 없거나, Supabase 환경 변수가 설정되지 않았습니다.

**해결 방법**:
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 파일 안에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`가 설정되어 있는지 확인
3. 다시 빌드: `npm run build`
4. 다시 배포: `npx firebase deploy --only hosting`

### 배포 후 변경사항이 반영되지 않음

**해결 방법**:
1. 브라우저에서 **하드 리프레시** (Ctrl+Shift+R / Cmd+Shift+R)
2. 브라우저 캐시 삭제
3. 시크릿 모드에서 확인

## 보안 주의사항

⚠️ **절대 Git에 커밋하지 마세요**:
- `.env.local` 파일은 이미 `.gitignore`에 포함되어 있습니다
- API 키와 시크릿 키를 공개 저장소에 올리지 마세요
- 팀원과 공유할 때는 안전한 방법(비밀번호 관리자, 암호화된 메시지 등)을 사용하세요

## 파일 위치

```
ijw-Calander-main/
├── .env.local          ← 실제 환경 변수 (Git에 커밋되지 않음)
├── .env.local.example  ← 환경 변수 예제 템플릿
└── DEPLOYMENT.md       ← 이 문서
```
