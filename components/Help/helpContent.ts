import { AppTab, TAB_META, TAB_GROUPS, PermissionId } from '../../types';

export interface HelpSubSection {
  title: string;
  items: string[];
  /** 이 섹션을 보려면 필요한 권한 (하나라도 있으면 표시, 미지정 시 항상 표시) */
  requiredPermissions?: PermissionId[];
}

export interface HelpEntry {
  tab: AppTab | 'overview';
  title: string;
  icon: string;
  group: string;
  overview: string;
  sections: HelpSubSection[];
}

// 시스템 개요 (탭이 아닌 전체 설명)
const systemOverview: HelpEntry = {
  tab: 'overview',
  title: '시스템 개요',
  icon: '📖',
  group: '',
  overview: '인재원 학원 관리 시스템의 기본 사용법입니다.',
  sections: [
    {
      title: '로그인',
      items: [
        'Google 계정으로 로그인합니다.',
        '최초 로그인 시 승인 대기 상태가 되며, 관리자(Master/Admin)가 승인해야 시스템을 사용할 수 있습니다.',
      ],
    },
    {
      title: '역할 체계',
      items: [
        'Master — 전체 시스템 관리자. 모든 기능 접근 가능',
        'Admin — 시스템 관리자. Master와 동일한 접근 권한',
        'Manager — 운영 매니저. 대부분의 기능 접근 가능',
        '수학팀장 / 영어팀장 — 해당 교과 총괄',
        '수학강사 / 영어강사 — 해당 교과 담당',
        'User — 기본 사용자. 대시보드, 일정, 출결만 접근',
      ],
    },
    {
      title: '탭 그룹 구조',
      items: [
        '홈 — 대시보드',
        '일정 — 연간 일정, 간트 차트',
        '수업 — 시간표, 출석부, 출결 관리, 수업 관리, 강의실, 강의실 배정',
        '학생 — 학생 관리, 등록 상담, 학생 상담, 성적 관리, 퇴원 관리',
        '관리 — 전자 결재, 직원 관리, 수납 관리, 자료실',
        '시스템 — 역할 관리',
      ],
    },
  ],
};

const tabHelpData: Record<AppTab, Omit<HelpEntry, 'tab' | 'icon' | 'group'>> = {
  dashboard: {
    title: '대시보드',
    overview: '로그인 후 첫 화면입니다. 역할에 따라 자동으로 다른 대시보드가 표시됩니다.',
    sections: [
      {
        title: '역할별 대시보드',
        items: [
          'Master/Admin — 전체 학원 KPI (재원생 수, 출석률, 상담 현황, 수납 현황), 직원별 대시보드 전환 가능',
          '매니저 — 운영 지표 요약, 오늘의 주요 현황',
          '수학/영어 팀장 — 해당 과목 학생 현황, 수업 통계, 성적 추이',
          '수학/영어 강사 — 담당 수업 출석, 담당 학생 현황',
          '일반 직원 — 기본 일정 및 공지사항',
        ],
      },
      {
        title: '주요 기능',
        items: [
          '오늘의 일정/출석/상담 요약',
          '최근 알림 확인',
          '직원 선택기 (Admin/Master) — 다른 직원 시점으로 전환하여 확인 가능',
        ],
      },
    ],
  },
  calendar: {
    title: '연간 일정',
    overview: '학원의 연간 일정을 관리하는 캘린더입니다. 부서별 일정 필터링, 다중 연도 비교가 가능합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '일간 — 하루 일정을 시간대별로 확인',
          '주간 — 한 주의 일정을 한눈에 확인',
          '월간 — 한 달 캘린더 형태로 일정 확인',
          '연간 — 1년 전체를 미니 캘린더로 조감 (1~3단 비교 뷰 지원)',
        ],
      },
      {
        title: '일정 관리',
        requiredPermissions: ['events.create', 'events.manage_own'],
        items: [
          '일정 추가 — 상단 "일정 추가" 버튼 또는 캘린더 빈 영역 클릭',
          '빠른 추가 — 날짜 클릭 후 간편 입력',
          '일정 수정 — 기존 일정 클릭 후 편집',
          '일정 삭제 — 일정 상세에서 삭제 버튼',
          '드래그 이동 — 일정을 드래그하여 다른 날짜로 이동',
        ],
      },
      {
        title: '부서 필터',
        items: [
          '부서별로 일정을 색상 구분하여 표시',
          '여러 부서를 동시에 선택/해제하여 필터링',
        ],
      },
      {
        title: '기타 기능',
        requiredPermissions: ['events.create', 'events.bucket'],
        items: [
          '해시태그 — 일정에 해시태그 추가/필터링 (#회의, #시험, #행사 등)',
          '버킷 리스트 — 날짜 미정 일정 임시 보관 후 캘린더로 드래그 배정',
          '참가 현황 — 일정별 참석 여부 관리',
          '이미지 내보내기 — 캘린더를 이미지로 저장',
          '보관된 일정 — 아카이브된 과거 일정 조회',
        ],
      },
    ],
  },
  gantt: {
    title: '간트 차트',
    overview: '프로젝트 기반 업무를 시각적으로 관리하는 간트 차트입니다.',
    sections: [
      {
        title: '주요 기능',
        requiredPermissions: ['gantt.create', 'gantt.edit'],
        items: [
          '프로젝트 관리 — 프로젝트 생성/수정/삭제',
          '태스크 관리 — 프로젝트 내 세부 작업, 시작일/종료일 설정',
          '담당자 배정 — 직원별 태스크 할당',
          '진행률 추적 — 태스크별 진행률(%) 관리',
          '시뮬레이션 모드 — 일정 변경을 미리 시뮬레이션 후 적용',
          '템플릿 — 자주 사용하는 프로젝트 구조를 저장/불러오기',
          '시나리오 관리 — 여러 시나리오 비교하여 최적안 선택',
        ],
      },
    ],
  },
  timetable: {
    title: '시간표',
    overview: '수학/영어/과학/국어 과목별 시간표를 관리합니다.',
    sections: [
      {
        title: '과목 및 뷰',
        items: [
          '과목 선택 — 상단 탭에서 수학, 영어, 과학, 국어 중 선택',
          '강사별 뷰 — 강사를 기준으로 수업 배치 확인',
          '교실별 뷰 — 교실을 기준으로 시간대별 수업 확인',
          '수업별 뷰 — 수업을 기준으로 시간/강사/교실 확인',
        ],
      },
      {
        title: '수업 관리',
        requiredPermissions: ['timetable.math.edit', 'timetable.english.edit', 'timetable.science.edit', 'timetable.korean.edit'],
        items: [
          '수업 추가 — "수업 추가" 버튼으로 새 수업 생성',
          '수업 수정 — 수업 카드 클릭 후 편집',
          '학생 배정 — 학생을 드래그앤드롭으로 수업에 배정',
        ],
      },
      {
        title: '기타 기능',
        requiredPermissions: ['timetable.math.edit', 'timetable.english.edit', 'timetable.english.simulation', 'timetable.math.simulation'],
        items: [
          '시뮬레이션 모드 — 변경사항을 실제 저장하지 않고 미리보기',
          '백업 (영어) — 현재 시간표를 백업 저장, 필요시 복원',
          '이미지 저장 — 시간표를 이미지로 내보내기',
          '설정 — 수업 키워드 색상, 스케줄 표기 방식 설정',
        ],
      },
    ],
  },
  attendance: {
    title: '출석부',
    overview: '수업별 월간/세션별 출석을 관리합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '월간 — 한 달 전체 출결 현황을 표로 확인',
          '세션별 — 개별 세션(수업 시간) 단위로 출결 체크',
        ],
      },
      {
        title: '출결 상태',
        items: [
          '출석 — 정상 출석',
          '결석 — 무단 결석',
          '지각 — 수업 시작 후 입실',
          '조퇴 — 수업 종료 전 퇴실',
          '사유결석 — 사전 통보 결석 (병결 등)',
        ],
      },
      {
        title: '출결 관리',
        requiredPermissions: ['attendance.manage_own', 'attendance.edit_all'],
        items: [
          '학생 이름 클릭으로 출결 상태 순환 변경',
          '학생 추가/제거',
          '세션 설정 — 세션 시간대 관리',
        ],
      },
      {
        title: '기타 기능',
        items: [
          '정렬 — 수업별 / 이름순',
          '월급 계산 (강사용)',
          '이미지 내보내기',
        ],
      },
    ],
  },
  'daily-attendance': {
    title: '출결 관리',
    overview: '일별 전체 출결 현황을 한눈에 확인하는 관리 뷰입니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '카드 뷰 — 수업별 카드 형태로 출결 현황 표시 (과목별 필터 가능)',
          '리스트 뷰 — 전체 학생 출결을 리스트로 표시',
          '통계 뷰 — 출석/지각/결석/조퇴/사유결석 통계',
        ],
      },
      {
        title: '주요 기능',
        items: [
          '달력 네비게이션으로 날짜 이동',
          '수업별 필터',
          '실시간 출결 통계 (출석률, 지각률 등)',
        ],
      },
    ],
  },
  classes: {
    title: '수업 관리',
    overview: '수업(반)을 생성하고 관리합니다.',
    sections: [
      {
        title: '조회 기능',
        items: [
          '과목별 필터 — 전체/수학/영어/과학/국어',
          '담임/부담임 필터 — 강사별 담당 수업 필터',
          '요일별 필터 — 특정 요일의 수업만 표시',
          '수업 상세 — 수업 카드 클릭 시 강사, 교실, 학생 목록 확인',
        ],
      },
      {
        title: '수업 관리',
        requiredPermissions: ['classes.create', 'classes.edit', 'classes.delete'],
        items: [
          '수업 생성 — 수업명, 과목, 담당 강사, 수업 시간, 교실 설정',
          '수업 수정/삭제 — 기존 수업 정보 변경',
          '학생 배정 — 수업에 학생 등록/해제',
        ],
      },
    ],
  },
  classroom: {
    title: '강의실',
    overview: '강의실 사용 현황을 시각적으로 확인합니다.',
    sections: [
      {
        title: '주요 기능',
        items: [
          '요일별 확인 — 요일 탭으로 전환',
          '교실/과목 필터 — 특정 교실이나 과목만 표시',
          '시간대별 필터 — 원하는 시간대의 교실 배정 확인',
          '점유율 확인 — 교실별 사용률 표시',
          '교실 블록 클릭 — 해당 시간의 수업 상세 정보 확인',
        ],
      },
    ],
  },
  'classroom-assignment': {
    title: '강의실 배정',
    overview: 'AI 기반으로 수업을 교실에 자동 배정하거나, 수동으로 배정합니다.',
    sections: [
      {
        title: '주요 기능',
        items: [
          'AI 자동 배정 — 배정 전략(프리셋) 선택 후 "자동 배정" 클릭',
          '수동 배정 — 드래그앤드롭으로 수업을 교실에 배치',
          '충돌 감지 — 같은 시간/교실에 중복 배정 시 경고',
          '병합 제안 — 소규모 수업을 합칠 수 있을 때 제안',
          '미리보기/원본 전환 — 변경 전/후 비교',
          '적용/초기화 — 변경사항 확정 또는 원래대로 복원',
        ],
      },
    ],
  },
  students: {
    title: '학생 관리',
    overview: '재원생 정보를 종합적으로 관리합니다. 2단 레이아웃(목록 + 상세)으로 구성됩니다.',
    sections: [
      {
        title: '학생 목록 (좌측)',
        items: [
          '검색 — 이름, 학교, 학년, 연락처 등 다중 필드 검색',
          '필터링 — 재원 상태, 과목, 학년, 담당 강사별 필터',
          '정렬 — 이름순, 학년순, 등록일순',
          '학생 추가 — "학생 추가" 버튼으로 신규 학생 등록',
        ],
      },
      {
        title: '학생 상세 (우측)',
        items: [
          '기본 정보 — 이름, 학교, 학년, 연락처, 보호자 정보',
          '수강 이력 — 현재/과거 수강 수업 목록, 수업 등록/해제',
          '성적 — 시험 성적, 레벨테스트 결과, 성적 추이 차트',
          '출결 — 출석 현황 요약',
          '메모 — 학생별 메모 관리',
        ],
      },
      {
        title: '관리 도구',
        requiredPermissions: ['students.edit', 'students.delete'],
        items: [
          '중복 학생 병합 — 같은 이름의 중복 데이터 통합',
          '데이터 정리 — 비활성 데이터 정리',
          '일괄 영어이름 업데이트 — 영어 이름 일괄 등록',
          '이름 내보내기 — 학생 명단 텍스트 복사',
        ],
      },
    ],
  },
  consultation: {
    title: '등록 상담',
    overview: '신규 학생 유치를 위한 등록 상담(입학 상담)을 관리합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '대시보드 — 상담 통계 요약 (월별 상담 수, 전환율 등)',
          '테이블 — 상담 목록을 표로 표시',
          '연도별 — 연도별 상담 추이 비교',
        ],
      },
      {
        title: '상담 등록',
        requiredPermissions: ['consultation.create'],
        items: [
          '"상담 등록" 버튼 클릭',
          '학생/보호자 정보, 상담 내용, 관심 과목, 레벨테스트 결과 입력',
          '레벨테스트 세분화 — 수학(계산력/이해력/추론력/문제해결력), 영어(AI/NELT/EiE)',
        ],
      },
      {
        title: '주요 기능',
        requiredPermissions: ['consultation.convert', 'consultation.manage'],
        items: [
          '원생 전환 — 상담 학생을 정식 재원생으로 전환 (레벨테스트 데이터 자동 복사)',
          'QR 토큰 생성 — 상담 접수용 QR 코드 생성',
          'QR 접수 — 학부모가 QR 스캔으로 상담 신청서 직접 작성',
        ],
      },
    ],
  },
  'student-consultations': {
    title: '학생 상담',
    overview: '재원생 대상 학부모/학생 상담 기록을 관리합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '목록 — 상담 기록 리스트',
          '대시보드 — 상담 통계 요약',
        ],
      },
      {
        title: '필터',
        items: [
          '기간 — 오늘, 이번 주, 이번 달, 지난 달, 최근 3개월, 전체',
          '유형별 / 카테고리별 / 후속 조치별 / 상담자별 필터',
          '페이지네이션 지원',
        ],
      },
      {
        title: '상담 등록',
        items: [
          '"상담 등록" 버튼으로 새 상담 기록 추가',
          '상담 유형, 카테고리, 상담 내용, 후속 조치 입력',
        ],
      },
    ],
  },
  grades: {
    title: '성적 관리',
    overview: '시험 성적과 레벨테스트 결과를 통합 관리합니다.',
    sections: [
      {
        title: '뷰 토글',
        items: [
          '시험 — 시험 목록, 성적 입력/조회',
          '레벨테스트 — 전체 학생 레벨테스트 결과 모아보기',
        ],
      },
      {
        title: '시험 관리',
        requiredPermissions: ['grades.edit', 'grades.manage_exams'],
        items: [
          '시험 등록 — 시험명, 날짜, 유형(일일/주간/월말/중간/기말/모의 등), 과목, 만점, 범위 설정',
          '성적 입력 — 시험 선택 후 학생별 점수 일괄 입력',
          '자동 통계 — 평균, 최고점, 최저점, 등수 자동 계산',
        ],
      },
      {
        title: '레벨테스트',
        items: [
          '전체 학생의 레벨테스트를 날짜별로 그룹핑하여 표시',
          '과목 필터 — 전체 / 수학 / 영어',
          '수학 — 계산력, 이해력, 추론력, 문제해결력, 내점수/평균/등급',
          '영어 — AI 레벨테스트, NELT, EiE 유형별 세부 결과',
          '학생 클릭 시 해당 학생의 성적 프로필 상세 확인',
        ],
      },
    ],
  },
  withdrawal: {
    title: '퇴원 관리',
    overview: '퇴원 또는 수강 종료된 학생을 관리합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '통계 — 퇴원/수강종료 통계 대시보드',
          '목록 — 퇴원생 리스트 (2단 레이아웃)',
        ],
      },
      {
        title: '필터',
        items: [
          '유형 — 전체 / 퇴원 / 수강종료',
          '과목, 담당 강사, 퇴원 사유별 필터',
          '기간 필터, 검색 기능',
          '정렬 — 퇴원일순 / 이름순',
        ],
      },
      {
        title: '퇴원 정보 수정',
        requiredPermissions: ['withdrawal.edit'],
        items: [
          '퇴원 사유 변경 — 퇴원 카테고리 및 상세 사유 수정',
          '상담 추적 — 관리자/담임 통화, 학생 상담 완료 체크',
        ],
      },
      {
        title: '재원 복구',
        requiredPermissions: ['withdrawal.reactivate'],
        items: [
          '재원 복구 — 퇴원 학생을 다시 재원 상태로 복구',
          '퇴원 정보(퇴원일, 사유, 메모, 상담기록) 초기화',
        ],
      },
    ],
  },
  payment: {
    title: '전자 결재',
    overview: '월별 수납 현황을 관리하고 보고서를 생성합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '대시보드 — 수납 현황 차트 및 통계',
          '보고서 — 상세 보고서 뷰',
        ],
      },
      {
        title: '주요 기능',
        items: [
          '수납 현황 — 월별 수납 금액, 사업장별 통계',
          '신규 등록 — 새 수납 항목 추가',
          'AI 보고서 생성 — AI가 수납 데이터를 분석하여 보고서 자동 생성',
          '인쇄용 뷰 — 보고서를 인쇄 가능한 형태로 표시',
          '지난달 데이터 가져오기 — 이전 월 사업장 목록 불러오기',
        ],
      },
    ],
  },
  staff: {
    title: '직원 관리',
    overview: '학원 직원(강사, 관리자, 스태프)을 통합 관리합니다.',
    sections: [
      {
        title: '뷰 모드',
        items: [
          '직원 목록 — 직원 정보 조회',
          '근무 일정 — 직원별 근무 스케줄 확인',
        ],
      },
      {
        title: '직원 정보',
        items: [
          '이름, 이메일, 연락처, 역할(강사/관리자/직원)',
          '담당 과목, 시간표 색상, 기본 강의실',
          '시스템 역할(권한 등급), 승인 상태, 소속 부서',
        ],
      },
      {
        title: '관리 기능',
        requiredPermissions: ['users.approve', 'users.change_role', 'users.change_permissions'],
        items: [
          '직원 추가 — 새 직원 등록',
          '권한 관리 — 직원별 시스템 접근 권한 설정',
          '승인 관리 — 신규 가입자 승인/차단',
          '휴가 관리 — 휴가 신청/승인 관리',
        ],
      },
    ],
  },
  billing: {
    title: '수납 관리',
    overview: '학생별 수납(수강료) 기록을 관리합니다.',
    sections: [
      {
        title: '조회 기능',
        items: [
          '상태 필터 — 전체 / 미납 / 완납',
          '월별 조회 — 청구 기간별 수납 현황',
          '통계 — 수납률, 미납 현황 요약',
          '페이지네이션 — 페이지 크기 조절 가능',
        ],
      },
      {
        title: '수납 관리',
        requiredPermissions: ['billing.edit'],
        items: [
          '수납 추가 — 새 수납 기록 등록',
          'Excel 가져오기 — xlsx 파일에서 수납 데이터 일괄 등록',
          'Excel 내보내기 — 수납 데이터를 엑셀로 다운로드',
        ],
      },
    ],
  },
  resources: {
    title: '자료실',
    overview: '학원 운영에 필요한 자료(문서, 링크 등)를 폴더 구조로 관리합니다.',
    sections: [
      {
        title: '폴더 구조',
        items: [
          '3단 탐색 — 홈 > 대분류 > 중분류 > 자료 목록',
          '브레드크럼 — 현재 위치를 상단에 표시, 클릭으로 상위 이동',
        ],
      },
      {
        title: '주요 기능',
        items: [
          '자료 추가 — 제목, 설명, URL, 유형, 카테고리 입력',
          '검색 — 제목, 설명, URL, 작성자 검색',
          '정렬 — 제목순, 유형순, 카테고리순, 작성자순, 날짜순',
          '즐겨찾기 — 자주 사용하는 자료에 별표 표시',
          '고정(Pin) — 중요 자료를 목록 상단에 고정',
          '다중 선택 — 여러 자료 선택 후 일괄 삭제',
          '카테고리 순서 — 드래그앤드롭으로 카테고리 정렬 변경',
        ],
      },
    ],
  },
  help: {
    title: '도움말',
    overview: '현재 보고 있는 이 페이지입니다. 모든 탭의 기능을 설명합니다.',
    sections: [
      {
        title: '주요 기능',
        items: [
          '좌측 목차에서 원하는 탭 선택',
          '상단 검색바로 기능명 검색',
          '인쇄 버튼으로 PDF 출력',
        ],
      },
    ],
  },
  'role-management': {
    title: '역할 관리',
    overview: '역할별 세부 권한과 탭 접근 권한을 설정합니다. Master 전용 기능입니다.',
    sections: [
      {
        title: '섹션',
        requiredPermissions: ['settings.role_permissions'],
        items: [
          '권한 설정 — 12개 카테고리별 세부 권한 ON/OFF',
          '탭 접근 관리 — 역할별로 접근 가능한 탭 설정',
        ],
      },
      {
        title: '권한 카테고리',
        requiredPermissions: ['settings.role_permissions'],
        items: [
          '학생 관리 — 학생 조회/수정/등록/삭제',
          '출석부 — 출석 조회/수정',
          '시간표 — 시간표 조회/수정',
          '수업 관리 — 수업 조회/수정/생성/삭제',
          '상담 — 상담 조회/수정/등록',
          '성적 — 성적 조회/수정/시험 관리',
          '일정 — 일정 조회/수정',
          '직원 관리 — 직원 정보 조회/수정',
          '수납 — 수납 조회/수정',
          '설정 — 시스템 설정 접근',
          '자료실 — 자료 조회/수정',
          '강의실 — 강의실 조회/수정',
        ],
      },
      {
        title: '주요 기능',
        requiredPermissions: ['settings.role_permissions'],
        items: [
          '역할 선택 후 카테고리별 접기/펼치기로 세부 권한 설정',
          '연동 권한 자동 처리 (예: "수정" 활성화 시 "조회" 자동 활성화)',
          '"기본값 초기화" 버튼으로 기본 설정 복원',
          '"저장" 버튼으로 변경사항 저장',
        ],
      },
    ],
  },
};

// 탭별 HelpEntry 생성 함수
function buildHelpEntries(): HelpEntry[] {
  const entries: HelpEntry[] = [systemOverview];

  for (const group of TAB_GROUPS) {
    for (const tabId of group.tabs) {
      const data = tabHelpData[tabId];
      const meta = TAB_META[tabId];
      if (data && meta) {
        entries.push({
          tab: tabId,
          title: meta.label,
          icon: meta.icon,
          group: group.label,
          ...data,
        });
      }
    }
  }

  return entries;
}

export const HELP_ENTRIES: HelpEntry[] = buildHelpEntries();

// 검색 유틸
export function searchHelp(entries: HelpEntry[], query: string): HelpEntry[] {
  if (!query.trim()) return entries;
  const lower = query.toLowerCase();
  return entries.filter((entry) => {
    if (entry.title.toLowerCase().includes(lower)) return true;
    if (entry.overview.toLowerCase().includes(lower)) return true;
    return entry.sections.some(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        s.items.some((item) => item.toLowerCase().includes(lower))
    );
  });
}
