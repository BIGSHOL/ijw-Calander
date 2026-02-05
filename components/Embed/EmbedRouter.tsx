// Embed Router Component
// URL 파라미터 기반 임베드 페이지 라우팅

import React, { Suspense, lazy } from 'react';
import { getEmbedParams, useValidateEmbedToken } from '../../hooks/useEmbedTokens';
import { AlertTriangle, Lock, Clock, ExternalLink } from 'lucide-react';

// Lazy load embed components
const MathTimetableEmbed = lazy(() => import('./MathTimetableEmbed'));

interface EmbedRouterProps {
  // 외부에서 주입받을 수도 있음
  embedType?: string;
  tokenValue?: string;
}

/**
 * 임베드 모드 감지
 * URL에 ?embed=xxx&token=xxx 파라미터가 있으면 임베드 모드
 */
export function isEmbedMode(): boolean {
  const { embed } = getEmbedParams();
  return !!embed;
}

const EmbedRouter: React.FC<EmbedRouterProps> = ({ embedType, tokenValue }) => {
  // URL 파라미터에서 값 추출 (props 우선)
  const params = getEmbedParams();
  const embed = embedType || params.embed;
  const token = tokenValue || params.token;

  // 토큰 검증
  const { isValid, token: validatedToken, error, loading } = useValidateEmbedToken(token);

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-gray-500 font-medium">인증 확인 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (!isValid || !validatedToken) {
    return <EmbedErrorPage error={error} />;
  }

  // 임베드 타입에 따라 컴포넌트 렌더링
  const renderEmbed = () => {
    switch (embed) {
      case 'math-timetable':
        return <MathTimetableEmbed token={validatedToken} />;
      // 추후 확장
      // case 'english-timetable':
      //   return <EnglishTimetableEmbed token={validatedToken} />;
      default:
        return <EmbedErrorPage error="NOT_FOUND" />;
    }
  };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">시간표 로딩 중...</span>
          </div>
        </div>
      }
    >
      {renderEmbed()}
    </Suspense>
  );
};

// 에러 페이지 컴포넌트
interface EmbedErrorPageProps {
  error?: 'NOT_FOUND' | 'EXPIRED' | 'INACTIVE' | string;
}

const EmbedErrorPage: React.FC<EmbedErrorPageProps> = ({ error }) => {
  const errorConfig = {
    NOT_FOUND: {
      icon: AlertTriangle,
      title: '유효하지 않은 링크',
      message: '이 공유 링크를 찾을 수 없습니다. 링크가 올바른지 확인해주세요.',
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    EXPIRED: {
      icon: Clock,
      title: '만료된 링크',
      message: '이 공유 링크는 만료되었습니다. 관리자에게 새 링크를 요청해주세요.',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    INACTIVE: {
      icon: Lock,
      title: '비활성화된 링크',
      message: '이 공유 링크는 비활성화되었습니다. 관리자에게 문의해주세요.',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  };

  const config = errorConfig[error as keyof typeof errorConfig] || errorConfig.NOT_FOUND;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className={`max-w-md w-full mx-4 p-8 rounded-xl shadow-lg ${config.bg}`}>
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${config.bg} mb-4`}>
            <Icon className={`w-8 h-8 ${config.color}`} />
          </div>
          <h1 className={`text-xl font-bold ${config.color} mb-2`}>{config.title}</h1>
          <p className="text-gray-600 mb-6">{config.message}</p>

          <div className="space-y-3">
            <a
              href={window.location.origin}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              학원 관리 시스템으로 이동
            </a>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedRouter;
