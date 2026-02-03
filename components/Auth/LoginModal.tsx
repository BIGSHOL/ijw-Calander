import React, { useState } from 'react';
import { X, Lock as LockIcon, LogIn, UserPlus, Mail, User, KeyRound } from 'lucide-react';
import { auth, db } from '../../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { StaffMember } from '../../types';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    canClose?: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, canClose = true }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState(''); // 이름(한글)
    const [jobTitle, setJobTitle] = useState(''); // 닉네임(영어이름) (선택)
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (isSignUp && password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                // Sign Up Logic
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Determine Role and Status
                // Master 이메일은 환경변수에서 관리 (콤마로 구분된 복수 이메일 지원)
                const masterEmails = (import.meta.env.VITE_MASTER_EMAILS || 'st2000423@gmail.com')
                    .split(',')
                    .map((e: string) => e.trim().toLowerCase());
                const isMaster = masterEmails.includes(email.toLowerCase());

                // 이메일로 기존 staff 검색 (기존 직원이 계정 연동하는 경우)
                const emailQuery = query(
                    collection(db, 'staff'),
                    where('email', '==', user.email)
                );
                const emailSnapshot = await getDocs(emailQuery);

                if (!emailSnapshot.empty) {
                    // 기존 staff에 uid 연동
                    const existingStaff = emailSnapshot.docs[0];
                    await updateDoc(existingStaff.ref, {
                        uid: user.uid,
                        name: displayName.trim() || existingStaff.data().name,
                        englishName: jobTitle.trim() || existingStaff.data().englishName || '',
                        systemRole: isMaster ? 'master' : (existingStaff.data().systemRole || 'user'),
                        approvalStatus: isMaster ? 'approved' : (existingStaff.data().approvalStatus || 'pending'),
                        updatedAt: new Date().toISOString(),
                    });
                    console.log('✅ Existing staff linked with new account:', existingStaff.id);
                } else {
                    // 신규 staff 생성 (staff 컬렉션만 사용)
                    const newStaffRef = doc(collection(db, 'staff'));
                    const newStaff: Partial<StaffMember> = {
                        id: newStaffRef.id,
                        uid: user.uid,
                        name: displayName.trim() || email.split('@')[0],
                        englishName: jobTitle.trim() || '',
                        email: user.email || '',
                        role: 'staff',
                        systemRole: isMaster ? 'master' : 'user',
                        approvalStatus: isMaster ? 'approved' : 'pending',
                        departmentPermissions: {},
                        favoriteDepartments: [],
                        hireDate: new Date().toISOString().split('T')[0],
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    await setDoc(newStaffRef, newStaff);
                    console.log('✅ New staff created from signup:', newStaffRef.id);
                }

                if (!isMaster) {
                    setError('계정이 생성되었습니다. 관리자 승인 후 로그인이 가능합니다.');
                } else {
                    onClose();
                }

            } else {
                // Login Logic
                await signInWithEmailAndPassword(auth, email, password);
                onClose();
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일입니다.');
            } else if (err.code === 'auth/weak-password') {
                setError('비밀번호는 6자 이상이어야 합니다.');
            } else {
                setError('오류가 발생했습니다: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError('이메일을 입력해주세요.');
            return;
        }

        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setError('비밀번호 재설정 링크가 이메일로 전송되었습니다.');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/user-not-found') {
                setError('등록되지 않은 이메일입니다.');
            } else if (err.code === 'auth/invalid-email') {
                setError('올바른 이메일 주소를 입력해주세요.');
            } else {
                setError('오류가 발생했습니다: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-start justify-center pt-[8vh] z-[100]"
            onClick={() => canClose && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
        >
            <div
                className="bg-white rounded-sm shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0 relative border border-gray-200"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="bg-[#081429] p-6 text-center shrink-0">
                    <div className="bg-[#fdb813] w-16 h-16 rounded-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
                        {isSignUp ? <UserPlus size={32} className="text-[#081429]" /> : <LockIcon size={32} className="text-[#081429]" />}
                    </div>
                    <h2 id="login-modal-title" className="text-xl font-bold text-white">
                        {isForgotPassword ? '비밀번호 찾기' : (isSignUp ? '관리자/직원 가입' : '로그인')}
                    </h2>
                    <p className="text-gray-300 text-sm mt-1">
                        {isForgotPassword ? '비밀번호 재설정 링크를 보내드립니다.' : (isSignUp ? '새로운 계정을 생성합니다.' : '인재원 Eywa에 로그인합니다.')}
                    </p>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#fdb813] focus:ring-offset-2 focus:ring-offset-[#081429]"
                        aria-label="닫기"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-8 overflow-y-auto flex-1">
                    <form onSubmit={isForgotPassword ? handleForgotPassword : handleAuth} className="space-y-3">

                        {/* Login Mode: 로그인 정보 */}
                        {!isSignUp && !isForgotPassword && (
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <LogIn className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">로그인 정보</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {/* Email Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">이메일</span>
                                        <input
                                            id="login-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="name@example.com"
                                            required
                                            aria-required="true"
                                            autoComplete="email"
                                        />
                                    </div>
                                    {/* Password Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <KeyRound className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">비밀번호</span>
                                        <input
                                            id="login-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="••••••••"
                                            required
                                            aria-required="true"
                                            autoComplete="current-password"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Signup Mode: Section 1 - 계정 정보 */}
                        {isSignUp && !isForgotPassword && (
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <LockIcon className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">계정 정보</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {/* Email Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">이메일 <span className="text-red-500">*</span></span>
                                        <input
                                            id="signup-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="name@example.com"
                                            required
                                            aria-required="true"
                                            autoComplete="email"
                                        />
                                    </div>
                                    {/* Password Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <KeyRound className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">비밀번호 <span className="text-red-500">*</span></span>
                                        <input
                                            id="signup-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="••••••••"
                                            required
                                            aria-required="true"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    {/* Confirm Password Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <KeyRound className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">비밀번호 확인 <span className="text-red-500">*</span></span>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Signup Mode: Section 2 - 개인 정보 */}
                        {isSignUp && !isForgotPassword && (
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <User className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">개인 정보</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {/* Display Name Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">이름(한글) <span className="text-red-500">*</span></span>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="홍길동"
                                            required
                                        />
                                    </div>
                                    {/* Job Title Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">닉네임 <span className="text-gray-400 text-xs">(영어)</span></span>
                                        <input
                                            type="text"
                                            value={jobTitle}
                                            onChange={(e) => setJobTitle(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="예: John, Alice"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Forgot Password Mode: 비밀번호 재설정 */}
                        {isForgotPassword && (
                            <div className="bg-white border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                    <LockIcon className="w-3 h-3 text-[#081429]" />
                                    <h3 className="text-[#081429] font-bold text-xs">비밀번호 재설정</h3>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {/* Instructions */}
                                    <div className="px-2 py-2">
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            등록된 이메일 주소로 비밀번호 재설정 링크를 보내드립니다.
                                            이메일을 확인하시고 링크를 클릭하여 새 비밀번호를 설정해주세요.
                                        </p>
                                    </div>
                                    {/* Email Row */}
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="w-14 shrink-0 text-xs font-medium text-[#373d41]">이메일</span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                            placeholder="name@example.com"
                                            required
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className={`p-3 text-sm rounded-sm flex items-center gap-2 font-medium ${error.includes('생성되었습니다') || error.includes('전송되었습니다') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-sm ${error.includes('생성되었습니다') || error.includes('전송되었습니다') ? 'bg-green-500' : 'bg-red-500'}`} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-[#081429] text-white rounded-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-sm animate-spin" />
                            ) : (
                                <>
                                    {isForgotPassword ? <LockIcon size={20} /> : (isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />)}
                                    {isForgotPassword ? '비밀번호 재설정 링크 보내기' : (isSignUp ? '가입하기' : '로그인')}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        {!isSignUp && !isForgotPassword ? (
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(true);
                                        setIsForgotPassword(false);
                                        setError('');
                                    }}
                                    className="text-sm font-bold text-[#fdb813] hover:underline"
                                >
                                    회원가입
                                </button>
                                <span className="text-gray-400">/</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsForgotPassword(true);
                                        setIsSignUp(false);
                                        setError('');
                                        setPassword('');
                                    }}
                                    className="text-sm font-bold text-[#fdb813] hover:underline"
                                >
                                    비밀번호찾기
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(false);
                                    setIsForgotPassword(false);
                                    setError('');
                                    setPassword('');
                                    setConfirmPassword('');
                                    setDisplayName('');
                                    setJobTitle('');
                                }}
                                className="text-sm font-bold text-[#fdb813] hover:underline"
                            >
                                로그인으로 돌아가기
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
