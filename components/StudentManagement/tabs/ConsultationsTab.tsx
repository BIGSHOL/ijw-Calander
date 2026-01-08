import React, { useEffect, useState } from 'react';
import { UnifiedStudent, TaskMemo } from '../../../types';
import { MessageSquare, User, Calendar, Mail, Loader2 } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  const [consultations, setConsultations] = useState<TaskMemo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TaskMemos 컬렉션에서 학생 관련 상담 이력 조회
    // Note: TaskMemo는 studentId 필드가 없으므로, 학생 이름으로 검색
    // 추후 TaskMemo 구조 변경 시 studentId 필드 추가 필요
    const q = query(
      collection(db, 'TaskMemos'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TaskMemo[];

        // 학생 이름이 포함된 메모 필터링 (임시 방법)
        const filtered = memos.filter(
          (memo) =>
            memo.message.includes(student.name) ||
            memo.toName === student.name ||
            memo.fromName === student.name
        );

        setConsultations(filtered);
        setLoading(false);
      },
      (error) => {
        console.error('상담 이력 조회 오류:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [student.name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg">상담 이력이 없습니다</p>
        <p className="text-sm mt-2 text-gray-400">
          상담 관리 탭에서 새로운 상담을 등록할 수 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          상담 이력 ({consultations.length}건)
        </h3>
      </div>

      {/* 알림 메시지 */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>참고:</strong> 현재 TaskMemos 컬렉션에서 학생 이름으로 검색된 메모를 표시합니다.
          추후 전용 상담 기록 시스템이 구축될 예정입니다.
        </p>
      </div>

      {/* 상담 목록 */}
      <div className="space-y-3">
        {consultations.map((consultation) => (
          <div
            key={consultation.id}
            className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
              consultation.isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'
            }`}
          >
            <div className="p-4">
              {/* 헤더 */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare
                    className={`w-5 h-5 ${
                      consultation.isRead ? 'text-gray-400' : 'text-blue-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {consultation.fromName}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {consultation.toName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(consultation.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>

              {/* 메시지 내용 */}
              <div className="pl-7">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {consultation.message}
                </p>
              </div>

              {/* 읽음 상태 표시 */}
              {!consultation.isRead && (
                <div className="mt-3 pl-7">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    읽지 않음
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 추가 기능 안내 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>향후 추가 예정:</strong> 학생별 전용 상담 기록 시스템, 상담 유형 분류,
          첨부 파일 등이 추가됩니다.
        </p>
      </div>
    </div>
  );
};

export default ConsultationsTab;
