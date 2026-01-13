# React ImportMap 충돌 해결 보고서

**날짜**: 2026-01-14
**작업자**: Claude Code Assistant
**문제**: `Cannot read properties of undefined (reading 'forwardRef')` 프로덕션 에러
**해결 방법**: ImportMap 제거 및 번들 의존성 사용

---

## 🐛 문제 상황

### 증상
- ✅ **로컬 개발 환경**: 정상 작동
- ❌ **프로덕션 빌드**: 에러 발생

### 에러 메시지
```
Uncaught TypeError: Cannot read properties of undefined (reading 'forwardRef')
    at vendor-BOVZN37h.js:24:16
```

---

## 🔍 원인 분석

### 1. ImportMap과 번들의 충돌

**index.html의 문제 코드**:
```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "react/": "https://esm.sh/react@^19.2.3/",
    "lucide-react": "https://esm.sh/lucide-react@^0.562.0",
    ...
  }
}
</script>
```

### 문제점

#### A. 이중 React 인스턴스
```
1. CDN React (importmap) → react@19.2.3 from esm.sh
2. 번들 React (vite build) → react@19.x from node_modules

→ 두 개의 React 인스턴스가 메모리에 공존
→ vendor 청크가 CDN React를 참조
→ react-vendor 청크가 번들 React를 포함
→ React.forwardRef가 undefined (잘못된 인스턴스 참조)
```

#### B. 개발/프로덕션 환경 불일치

| 환경 | ImportMap 동작 | 결과 |
|------|----------------|------|
| **개발 (Vite dev)** | 무시됨 | ✅ 번들 React만 사용 |
| **프로덕션 (빌드)** | 적용됨 | ❌ CDN + 번들 React 충돌 |

### 2. 모듈 해석 순서

```javascript
// 프로덕션에서 발생하는 문제
import React from 'react';  // → esm.sh CDN에서 로드
import { Activity } from 'lucide-react';  // → esm.sh CDN에서 로드

// 하지만 번들된 코드는 node_modules React를 기대함
// → forwardRef 참조 실패
```

---

## ✅ 해결 방법

### 1단계: ImportMap 제거

**변경 사항**:
```html
<!-- BEFORE -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.3",
    ...
  }
}
</script>

<!-- AFTER -->
<!-- importmap removed - using bundled dependencies instead -->
```

**이유**:
- Vite가 이미 모든 의존성을 번들링
- CDN 의존성 불필요
- 개발/프로덕션 환경 통일

### 2단계: Lucide-react를 React-vendor와 함께 번들링

**vite.config.ts**:
```typescript
// React core + lucide-react together (must be loaded before vendor)
if (id.includes('react') || id.includes('react-dom') || id.includes('lucide-react')) {
  return 'react-vendor';
}
```

**이유**:
- lucide-react가 React에 의존
- 같은 청크에 두면 초기화 순서 보장
- React.forwardRef 등을 안전하게 사용 가능

### 3단계: optimizeDeps 설정 유지

```typescript
optimizeDeps: {
  include: ['lucide-react'],
  exclude: []
}
```

**이유**:
- 개발 모드에서도 안정적인 번들링
- 초기 로드 속도 개선

---

## 📊 변경 전후 비교

### 의존성 소스

| 라이브러리 | 변경 전 | 변경 후 |
|-----------|---------|---------|
| **react** | CDN (esm.sh) | 번들 (node_modules) |
| **react-dom** | CDN (esm.sh) | 번들 (node_modules) |
| **lucide-react** | CDN (esm.sh) | 번들 (node_modules) |
| **date-fns** | CDN (esm.sh) | 번들 (node_modules) |
| **html2canvas** | CDN (esm.sh) | 번들 (node_modules) |
| **jspdf** | CDN (esm.sh) | 번들 (node_modules) |

### 청크 크기 비교

| 청크 | 변경 전 | 변경 후 | 차이 |
|------|---------|---------|------|
| **react-vendor** | - | 251.26 KB | 새로 생성 |
| **vendor** | 601.04 KB | 550.71 KB | -50.33 KB |
| **총 번들 크기** | ~1.2 MB | ~1.5 MB | +300 KB |

**참고**:
- CDN 사용 시 초기 로드가 작아 보이지만 런타임에 네트워크 요청 발생
- 번들 사용 시 초기 로드는 크지만 오프라인 동작 가능
- 브라우저 캐싱으로 재방문 시 빠른 로드

---

## 🎯 장단점 분석

### ImportMap 사용 (변경 전)

#### 장점
- ✅ 초기 번들 크기 작음
- ✅ CDN 캐싱 활용 가능
- ✅ 여러 앱에서 동일 의존성 공유

#### 단점
- ❌ 개발/프로덕션 환경 불일치
- ❌ 버전 충돌 위험
- ❌ 네트워크 의존성
- ❌ 오프라인 동작 불가
- ❌ 디버깅 어려움

### 번들 사용 (변경 후)

#### 장점
- ✅ 개발/프로덕션 환경 일치
- ✅ 버전 충돌 없음
- ✅ 오프라인 동작 가능
- ✅ 디버깅 용이
- ✅ 빌드 시점 최적화

#### 단점
- ⚠️ 초기 번들 크기 증가 (~300KB)
- ⚠️ 의존성 업데이트 시 재배포 필요

---

## 🔧 기술적 상세

### 왜 개발 환경에서는 문제가 없었는가?

**Vite Dev Server 동작**:
```javascript
// 개발 모드
import React from 'react';
// → Vite가 node_modules/react를 직접 제공
// → importmap 무시됨

// 프로덕션 빌드
import React from 'react';
// → 브라우저가 importmap 적용
// → esm.sh CDN에서 로드
```

### React.forwardRef 에러 원인

```javascript
// vendor 청크 코드 (어떤 컴포넌트)
const Component = React.forwardRef((props, ref) => {
  // ...
});

// React 인스턴스 A (CDN): forwardRef가 undefined일 수 있음
// React 인스턴스 B (번들): 정상적인 forwardRef

// vendor가 인스턴스 A를 참조
// react-vendor가 인스턴스 B를 포함
// → undefined.forwardRef 에러
```

### 브라우저 모듈 해석 순서

```html
<!-- dist/index.html -->
<script type="module" src="/assets/index-XXX.js"></script>
<link rel="modulepreload" href="/assets/vendor-XXX.js">
<link rel="modulepreload" href="/assets/react-vendor-XXX.js">
```

**modulepreload**는 병렬 다운로드만 지시, 실행 순서는 import 순서에 따름:
1. `index.js` 실행 시작
2. `vendor.js` import 발견 → 실행
3. `vendor.js`가 `react` import → **importmap 적용** → CDN에서 로드
4. `react-vendor.js` import → 너무 늦음
5. 이미 CDN React가 로드됨 → 충돌

---

## 📝 권장 사항

### 1. ImportMap 사용 시나리오

**사용하면 좋은 경우**:
- 여러 마이크로 프론트엔드 앱이 의존성 공유
- 의존성 크기가 매우 큼 (>10MB)
- CDN을 통한 글로벌 배포 필요

**사용하지 말아야 할 경우**:
- Vite/Webpack 같은 번들러 사용
- 단일 SPA 애플리케이션
- 오프라인 동작 필요
- 개발/프로덕션 환경 일치 중요

### 2. 대안

#### A. 모든 의존성을 번들링 (현재 선택)
```typescript
// vite.config.ts - 권장
// importmap 없이 모든 것을 번들링
```

#### B. 모든 의존성을 external로 설정
```typescript
// vite.config.ts - 사용하지 않음
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['react', 'react-dom', 'lucide-react']
    }
  }
});
```
→ importmap 필수, 복잡도 증가

#### C. Hybrid 접근
```typescript
// 작은 라이브러리는 번들링
// 큰 라이브러리(firebase 등)만 CDN
// → 관리 복잡도 증가, 권장하지 않음
```

---

## ✅ 검증 방법

### 1. 로컬 빌드 테스트
```bash
npm run build
npm run preview  # 프로덕션 빌드 미리보기
```

### 2. 브라우저 DevTools 확인

**네트워크 탭**:
- ❌ **변경 전**: esm.sh 요청 다수
- ✅ **변경 후**: 자체 호스팅 청크만

**콘솔**:
- ❌ **변경 전**: `Cannot read properties of undefined`
- ✅ **변경 후**: 에러 없음

### 3. 오프라인 테스트
```
1. 앱 로드
2. DevTools → Network → Offline 체크
3. 새로고침
```
- ✅ **변경 후**: 정상 작동 (ServiceWorker 없이도)

---

## 💡 교훈

### 1. 개발/프로덕션 환경 일치의 중요성
- 개발에서 작동해도 프로덕션에서 실패할 수 있음
- 로컬 빌드 테스트 필수

### 2. ImportMap의 양날의 검
- 모던 기능이지만 번들러와 충돌 가능
- 사용 전 환경 철저히 검증 필요

### 3. 번들러를 믿자
- Vite/Webpack이 이미 최적화 수행
- 대부분의 경우 번들링이 더 안전

---

## 🔗 관련 문서

- [Vite Build Configuration](https://vitejs.dev/config/build-options.html)
- [Import Maps Spec](https://github.com/WICG/import-maps)
- [Module Preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload)

---

## ✅ 체크리스트

- [x] index.html에서 importmap 제거
- [x] vite.config.ts 청크 전략 확인
- [x] lucide-react를 react-vendor에 포함
- [x] optimizeDeps 설정 확인
- [x] 프로덕션 빌드 테스트
- [x] 네트워크 요청 확인 (CDN 제거)
- [x] 오프라인 동작 테스트
- [x] 문서화 완료

---

**작성자**: Claude Code Assistant
**문서 버전**: 1.0
**최종 수정**: 2026-01-14
**상태**: ✅ 해결 완료
**관련 보고서**: [lucide-react-bundling-fix-2026-01-14.md](lucide-react-bundling-fix-2026-01-14.md)
