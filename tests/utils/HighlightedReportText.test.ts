import React from 'react';
import { render } from '@testing-library/react';
import { HighlightedReportText } from '../../utils/HighlightedReportText';

vi.mock('../../utils/formatReportContent', () => ({
  formatReportContent: (text: unknown) => String(text ?? ''),
}));

describe('HighlightedReportText', () => {
  it('[?텍스트] 형식에서 의심 텍스트 전체를 하이라이트해야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '[?티켓 찍으려 한다]며 추가 스트레스' })
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('티켓 찍으려 한다');
    expect(marks[0].className).toContain('bg-yellow-200');
  });

  it('[?고유명사] 형식을 하이라이트해야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '[?대구일중]에 다니고 있습니다' })
    );
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('대구일중');
    expect(mark?.getAttribute('title')).toContain('음성인식 불확실');
  });

  it('구형식 [?]도 하위호환으로 하이라이트해야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '티켓 찍으려 한다[?]며 스트레스' })
    );
    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('[?]');
  });

  it('[?]가 없는 텍스트는 mark 태그가 없어야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '정상적인 텍스트입니다' })
    );
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('정상적인 텍스트입니다');
  });

  it('여러 [?텍스트] 마커를 모두 하이라이트해야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '[?첫번째]와 [?두번째] 그리고 정상' })
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('첫번째');
    expect(marks[1].textContent).toBe('두번째');
  });

  it('className prop이 적용되어야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '텍스트', className: 'custom-class' })
    );
    expect(container.querySelector('span')?.className).toContain('custom-class');
  });

  it('빈 입력을 처리해야 함', () => {
    const { container } = render(
      React.createElement(HighlightedReportText, { content: '' })
    );
    expect(container.textContent).toBe('');
  });
});
