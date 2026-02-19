import React, { forwardRef } from 'react';

export interface TextbookRequestData {
  studentName: string;
  teacherName: string;
  requestDate: string; // YYYY-MM-DD
  bookName: string;
  bookDetail?: string;
  price: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

interface TextbookPreviewCardProps {
  data: TextbookRequestData;
}

export const TextbookPreviewCard = forwardRef<HTMLDivElement, TextbookPreviewCardProps>(
  ({ data }, ref) => {
    const formattedPrice = `${data.price.toLocaleString()}원`;

    const dateParts = data.requestDate ? data.requestDate.split('-') : [];
    const year = dateParts[0] || '';
    const month = dateParts[1] || '';
    const day = dateParts[2] || '';
    const formattedDate =
      year && month && day
        ? `${year}. ${parseInt(month, 10)}. ${parseInt(day, 10)}`
        : '';

    return (
      <div className="w-full flex justify-center p-4">
        {/* Paper Container */}
        <div
          ref={ref}
          className="bg-white w-[720px] h-auto min-h-[500px] p-12 shadow-2xl text-black font-serif relative"
        >
          {/* Header */}
          <div className="flex justify-between items-end mb-16 pb-4 gap-8">
            {/* Logo placeholder */}
            <div className="select-none shrink-0 flex items-center justify-center h-14 px-4 border border-gray-300 rounded text-gray-500 text-sm tracking-widest">
              학원 로고
            </div>
            <h1 className="text-5xl font-bold tracking-widest text-black mb-2 whitespace-nowrap shrink-0">
              교재 요청서
            </h1>
          </div>

          {/* Student Info Table */}
          <div className="border-[2px] border-black mb-10 flex">
            {/* Left vertical header */}
            <div className="w-20 border-r border-black flex items-center justify-center bg-gray-50">
              <span className="text-lg text-center whitespace-nowrap">학생정보</span>
            </div>

            {/* Right rows */}
            <div className="flex-1 flex flex-col">
              {/* Row 1: 이름 */}
              <div className="flex border-b border-black h-12">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>이 름</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-lg font-medium">
                  {data.studentName}
                </div>
              </div>

              {/* Row 2: 담임선생님 */}
              <div className="flex border-b border-black h-12">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>담임선생님</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-lg font-medium relative">
                  {data.teacherName}
                  <span className="text-gray-500 text-sm ml-3">(인)</span>
                </div>
              </div>

              {/* Row 3: 요청일자 */}
              <div className="flex h-12">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>요청일자</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-lg font-medium tracking-wider">
                  {formattedDate}
                </div>
              </div>
            </div>
          </div>

          {/* Request Details Table */}
          <div className="border-[2px] border-black mt-10 flex">
            {/* Left vertical header */}
            <div className="w-20 border-r border-black flex items-center justify-center bg-gray-50">
              <span className="text-lg text-center whitespace-nowrap">요청내용</span>
            </div>

            {/* Right rows */}
            <div className="flex-1 flex flex-col">
              {/* Row 1: 교재명 */}
              <div className="flex border-b border-black min-h-12 items-stretch">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>교재명</span>
                </div>
                <div className="flex-1 flex flex-col justify-center text-lg font-medium p-2 text-center">
                  <div>{data.bookName || '교재명을 입력하세요'}</div>
                  {data.bookDetail ? (
                    <div className="text-base font-normal mt-1">{data.bookDetail}</div>
                  ) : null}
                </div>
              </div>

              {/* Row 2: 금액 */}
              <div className="flex border-b border-black h-12">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>금액</span>
                </div>
                <div className="flex-1 flex items-center justify-center text-xl font-medium tracking-wide">
                  <span>{formattedPrice}</span>
                </div>
              </div>

              {/* Row 3: 계좌 */}
              <div className="flex h-16">
                <div className="w-24 border-r border-black flex items-center justify-center text-base">
                  <span>계좌</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-base font-medium gap-1">
                  <span>
                    {data.bankName} (예금주: {data.accountHolder})
                  </span>
                  <span>{data.accountNumber}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TextbookPreviewCard.displayName = 'TextbookPreviewCard';
