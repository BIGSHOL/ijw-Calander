import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ScheduledDateModal from '../../components/Timetable/Math/components/ScheduledDateModal';

// date-fns addDays mock 불필요 - 실제 함수 사용

describe('ScheduledDateModal', () => {
  const defaultProps = {
    studentName: '김학생',
    fromClassName: '수학A',
    toClassName: '수학B',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('학생 이름과 반 이름을 표시한다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      expect(screen.getByText('김학생')).toBeInTheDocument();
      expect(screen.getByText('수학A')).toBeInTheDocument();
      expect(screen.getByText('수학B')).toBeInTheDocument();
    });

    it('헤더에 "반 이동 날짜 설정"이 표시된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);
      expect(screen.getByText('반 이동 날짜 설정')).toBeInTheDocument();
    });

    it('즉시 이동과 예정일 지정 라디오 버튼이 있다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      expect(screen.getByText('즉시 이동 (오늘)')).toBeInTheDocument();
      expect(screen.getByText('예정일 지정')).toBeInTheDocument();
    });

    it('기본값은 즉시 이동이 선택되어 있다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      // 첫 번째 radio = 즉시 이동 (checked)
      expect(radios[0].checked).toBe(true);
      // 두 번째 radio = 예정일 지정 (unchecked)
      expect(radios[1].checked).toBe(false);
    });

    it('즉시 이동 모드에서는 date input이 표시되지 않는다', () => {
      render(<ScheduledDateModal {...defaultProps} />);
      expect(screen.queryByDisplayValue('')).toBeNull();
      // type="date" input이 없어야 함
      const dateInput = document.querySelector('input[type="date"]');
      expect(dateInput).toBeNull();
    });

    it('확인, 취소 버튼이 있다', () => {
      render(<ScheduledDateModal {...defaultProps} />);
      expect(screen.getByText('확인')).toBeInTheDocument();
      expect(screen.getByText('취소')).toBeInTheDocument();
    });
  });

  describe('즉시 이동 모드', () => {
    it('확인 클릭 시 onConfirm(undefined)가 호출된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      fireEvent.click(screen.getByText('확인'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(undefined);
    });
  });

  describe('예정일 지정 모드', () => {
    it('예정일 지정을 선택하면 date input이 나타난다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      // 예정일 지정 라디오 클릭
      fireEvent.click(screen.getByText('예정일 지정'));

      const dateInput = document.querySelector('input[type="date"]');
      expect(dateInput).not.toBeNull();
    });

    it('날짜 미선택 시 확인 버튼이 비활성화된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      fireEvent.click(screen.getByText('예정일 지정'));

      const confirmBtn = screen.getByText('확인');
      expect(confirmBtn).toBeDisabled();
    });

    it('날짜 선택 후 확인 클릭 시 onConfirm(selectedDate)가 호출된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      // 예정일 지정 선택
      fireEvent.click(screen.getByText('예정일 지정'));

      // 날짜 입력
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } });

      // 확인 클릭
      fireEvent.click(screen.getByText('확인'));

      expect(defaultProps.onConfirm).toHaveBeenCalledWith('2026-04-01');
    });

    it('date input의 min 속성이 내일 날짜로 설정된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      fireEvent.click(screen.getByText('예정일 지정'));

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      // min은 내일 날짜 (YYYY-MM-DD 형식)
      expect(dateInput.min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('모드 전환', () => {
    it('예정일 → 즉시 이동으로 전환 후 확인 시 undefined가 전달된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      // 예정일 지정 선택 → 날짜 입력
      fireEvent.click(screen.getByText('예정일 지정'));
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-04-01' } });

      // 다시 즉시 이동으로 전환
      fireEvent.click(screen.getByText('즉시 이동 (오늘)'));

      // 확인
      fireEvent.click(screen.getByText('확인'));
      expect(defaultProps.onConfirm).toHaveBeenCalledWith(undefined);
    });
  });

  describe('닫기', () => {
    it('취소 버튼 클릭 시 onClose가 호출된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      fireEvent.click(screen.getByText('취소'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('X 버튼 클릭 시 onClose가 호출된다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      // × 버튼
      fireEvent.click(screen.getByText('×'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('배경 클릭 시 onClose가 호출된다', () => {
      const { container } = render(<ScheduledDateModal {...defaultProps} />);

      // 최외곽 overlay div 클릭
      const overlay = container.firstChild as HTMLElement;
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('모달 내부 클릭 시 onClose가 호출되지 않는다', () => {
      render(<ScheduledDateModal {...defaultProps} />);

      // 모달 내부 컨텐츠 클릭
      fireEvent.click(screen.getByText('반 이동 날짜 설정'));
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
