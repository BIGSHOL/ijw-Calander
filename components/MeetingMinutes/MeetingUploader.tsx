import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Mic, MicOff, Calendar, User, Users, X, Square, PenLine } from 'lucide-react';
import { useUploadMeetingRecording } from '../../hooks/useMeetingRecording';
import { format } from 'date-fns';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { getKoreanErrorMessage } from '../../utils/errorMessages';

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'];
const ACCEPTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg'];
const MAX_FILE_SIZE = 200 * 1024 * 1024;

interface MeetingUploaderProps {
  onUploadStart: (reportId: string) => void;
}

function formatTimer(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function MeetingUploader({ onUploadStart }: MeetingUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { uploadAndProcess, uploadProgress, isUploading, isProcessing } = useUploadMeetingRecording();

  // 메타 입력
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [meetingDate, setMeetingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [recorder, setRecorder] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');

  // 녹음 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // 실시간 전사
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState('');
  const [speechStatus, setSpeechStatus] = useState<'off' | 'starting' | 'active' | 'error'>('off');

  // 참석자 태그 추가
  const addAttendee = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || attendees.includes(trimmed)) return;
    setAttendees(prev => [...prev, trimmed]);
    setAttendeeInput('');
  };

  const handleAttendeeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && attendeeInput.trim()) {
      e.preventDefault();
      addAttendee(attendeeInput);
    }
    if (e.key === 'Backspace' && !attendeeInput && attendees.length > 0) {
      setAttendees(prev => prev.slice(0, -1));
    }
  };

  const removeAttendee = (index: number) => {
    setAttendees(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // AssemblyAI 실시간 전사
  const startRealtimeTranscription = async (stream: MediaStream) => {
    setSpeechStatus('starting');
    try {
      const fns = getFunctions(getApp(), 'asia-northeast3');
      const createToken = httpsCallable<Record<string, never>, { token: string }>(fns, 'createRealtimeToken');
      const { data } = await createToken({});
      const token = data.token;

      const params = new URLSearchParams({
        sample_rate: '16000',
        speech_model: 'universal-streaming-multilingual',
        token,
      });
      const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params}`);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => setSpeechStatus('active');
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'Turn') {
          if (msg.end_of_turn && msg.transcript) {
            setLiveTranscript(prev => [...prev, msg.transcript]);
            setInterimText('');
          } else if (!msg.end_of_turn && msg.transcript) {
            setInterimText(msg.transcript);
          }
        }
      };
      ws.onerror = () => setSpeechStatus('error');
      ws.onclose = () => setSpeechStatus(prev => prev === 'error' ? 'error' : 'off');
      wsRef.current = ws;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch {
      setSpeechStatus('error');
    }
  };

  const stopRealtimeTranscription = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'Terminate' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setInterimText('');
    setSpeechStatus('off');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `회의녹음_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.webm`, { type: 'audio/webm' });
        setSelectedFile(file);
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      setRecordSeconds(0);
      setSelectedFile(null);
      setError('');
      setLiveTranscript([]);
      setInterimText('');
      startRealtimeTranscription(stream);
      timerRef.current = setInterval(() => setRecordSeconds(prev => prev + 1), 1000);
    } catch {
      setError('마이크 접근이 거부되었습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    stopRealtimeTranscription();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return `파일 크기가 200MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) return '지원하지 않는 파일 형식입니다. (mp3, m4a, wav, webm, ogg만 가능)';
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError('');
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError('회의 제목을 입력해주세요.'); return; }
    if (!meetingDate) { setError('회의 날짜를 선택해주세요.'); return; }
    if (!selectedFile) { setError('녹음 파일을 선택해주세요.'); return; }

    setError('');
    try {
      const result = await uploadAndProcess({
        file: selectedFile,
        title: title.trim(),
        attendees,
        meetingDate,
        recorder: recorder.trim(),
      });
      onUploadStart(result.reportId);
    } catch (err: any) {
      setError(getKoreanErrorMessage(err, '업로드 중 오류가 발생했습니다.'));
    }
  };

  const isSubmitting = isUploading || isProcessing;

  return (
    <div className="bg-white rounded-sm border shadow-sm">
      <div className="px-5 py-4 border-b bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <PenLine size={18} className="text-accent-500" />
          새 회의 녹음 분석
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          직접 녹음하거나 파일을 업로드하면 자동으로 음성인식 → AI 분석 → 회의록 생성이 진행됩니다.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* 메타 입력 */}
        <div className="space-y-3">
          {/* 회의 제목 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <PenLine size={12} className="inline mr-1" />
              회의 제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 3월 정기 운영회의"
              className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
              disabled={isSubmitting || isRecording}
            />
          </div>

          {/* 참석자 (복수 태그) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Users size={12} className="inline mr-1" />
              참석자 <span className="text-gray-400 font-normal">(이름 입력 후 Enter)</span>
            </label>
            <div className={`flex flex-wrap items-center gap-1.5 min-h-[38px] px-2 py-1.5 border rounded-sm focus-within:ring-1 focus-within:ring-accent-400 ${isSubmitting || isRecording ? 'bg-gray-50' : 'bg-white'}`}>
              {attendees.map((name, i) => (
                <span key={`${name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-100 text-accent-800 text-sm rounded-sm">
                  {name}
                  {!isSubmitting && !isRecording && (
                    <button type="button" onClick={() => removeAttendee(i)} className="hover:text-red-500">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleAttendeeKeyDown}
                placeholder={attendees.length ? '' : '참석자 이름 입력 후 Enter'}
                className="flex-1 min-w-[120px] py-0.5 text-sm bg-transparent outline-none"
                disabled={isSubmitting || isRecording}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 회의 날짜 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar size={12} className="inline mr-1" />
                회의 날짜 *
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
                disabled={isSubmitting || isRecording}
              />
            </div>

            {/* 기록자 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <User size={12} className="inline mr-1" />
                기록자
              </label>
              <input
                type="text"
                value={recorder}
                onChange={(e) => setRecorder(e.target.value)}
                placeholder="기록자 이름 (선택)"
                className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
                disabled={isSubmitting || isRecording}
              />
            </div>
          </div>
        </div>

        {/* 녹음 버튼 */}
        <div className="flex flex-col items-center py-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSubmitting}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${isRecording
                ? 'bg-red-100 border-2 border-red-400 text-red-600 animate-pulse hover:bg-red-200'
                : 'bg-gray-100 border-2 border-gray-300 text-gray-500 hover:bg-gray-200 hover:border-gray-400'
              }
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            {isRecording ? '녹음 중 — 누르면 정지' : '눌러서 녹음 시작'}
          </p>
          {(isRecording || recordSeconds > 0) && (
            <p className={`text-2xl font-mono mt-1 ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
              {formatTimer(recordSeconds)}
            </p>
          )}
        </div>

        {/* 실시간 전사 미리보기 */}
        {(isRecording || liveTranscript.length > 0) && (
          <div className="bg-gray-50 border rounded-sm p-4 max-h-48 overflow-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${
                speechStatus === 'active' ? 'bg-green-500 animate-pulse'
                : speechStatus === 'starting' ? 'bg-yellow-500 animate-pulse'
                : speechStatus === 'error' ? 'bg-red-500'
                : isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
              }`} />
              <span className="text-xs font-medium text-gray-500">
                {speechStatus === 'error' ? '음성인식 미지원 — 녹음은 정상 진행 중'
                  : speechStatus === 'starting' ? '음성인식 연결 중...'
                  : isRecording ? '실시간 전사 (미리보기)'
                  : '전사 미리보기 — 정확한 결과는 분석 후 확인'}
              </span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {liveTranscript.join(' ')}
              {interimText && <span className="text-gray-400">{liveTranscript.length > 0 ? ' ' : ''}{interimText}</span>}
              {!liveTranscript.length && !interimText && isRecording && (
                <span className="text-gray-400">말씀하시면 여기에 텍스트가 표시됩니다...</span>
              )}
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 border-t" />
          <span>또는 파일 업로드</span>
          <div className="flex-1 border-t" />
        </div>

        {/* 파일 업로드 영역 */}
        <div
          className={`border-2 border-dashed rounded-sm p-6 text-center transition-colors cursor-pointer
            ${isDragOver ? 'border-accent-400 bg-accent-50' : 'border-gray-300 hover:border-gray-400'}
            ${isSubmitting || isRecording ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); e.target.value = ''; }}
            className="hidden"
          />
          <Upload size={24} className="mx-auto text-gray-400 mb-1" />
          <p className="text-sm text-gray-600">파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-gray-400 mt-0.5">MP3, M4A, WAV, WebM, OGG (최대 200MB)</p>
        </div>

        {/* 선택된 파일 */}
        {selectedFile && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-sm px-4 py-2.5">
            <Mic size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 truncate">{selectedFile.name}</p>
              <p className="text-xs text-green-600">{(selectedFile.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
            <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-green-100 rounded-sm flex-shrink-0">
              <X size={16} className="text-green-500" />
            </button>
          </div>
        )}

        {/* 업로드 진행률 */}
        {uploadProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>업로드 중...</span>
              <span>{uploadProgress.percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-accent-500 transition-all duration-300" style={{ width: `${uploadProgress.percent}%` }} />
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-sm">{error}</p>}

        {/* 제출 */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isRecording || !selectedFile}
          className={`w-full py-3 rounded-sm font-medium text-sm transition-colors
            ${isSubmitting || isRecording || !selectedFile
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#081429] text-white hover:bg-[#0f2340]'
            }`}
        >
          {isUploading ? '업로드 중...' : isProcessing ? '분석 요청 중...' : '회의록 분석 시작'}
        </button>
      </div>
    </div>
  );
}
