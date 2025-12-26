import React, { useState } from 'react';
import { X, Lock as LockIcon, LogIn, UserPlus } from 'lucide-react';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    canClose?: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, canClose = true }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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
                // Master hardcoded logic
                const isMaster = email === 'st2000423@gmail.com';

                const newProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    role: isMaster ? 'master' : 'user',
                    status: isMaster ? 'approved' : 'pending',
                    allowedDepartments: [], // Default none until approved/assigned
                    canEdit: isMaster // Master can edit by default
                };

                // Create User Document
                await setDoc(doc(db, 'users', user.uid), newProfile);

                if (!isMaster) {
                    setError('계정이 생성되었습니다. 관리자 승인 후 로그인이 가능합니다.');
                    // Optionally sign out immediately if we want to enforce approval before ANY access
                    // But App.tsx handles the "pending" state check.
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

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setError('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-0 relative overflow-hidden border border-gray-200">

                {/* Header */}
                <div className="bg-[#081429] p-6 text-center">
                    <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        {isSignUp ? <UserPlus size={32} className="text-[#fdb813]" /> : <LockIcon size={32} className="text-[#fdb813]" />}
                    </div>
                    <h2 className="text-xl font-bold text-white">{isSignUp ? '관리자/직원 가입' : '로그인'}</h2>
                    <p className="text-blue-200 text-sm mt-1">
                        {isSignUp ? '새로운 계정을 생성합니다.' : '일정 관리 시스템에 접속합니다.'}
                    </p>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#081429] focus:ring-2 focus:ring-[#081429]/10 outline-none transition-all font-medium"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#081429] focus:ring-2 focus:ring-[#081429]/10 outline-none transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#081429] focus:ring-2 focus:ring-[#081429]/10 outline-none transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        )}

                        {error && (
                            <div className={`p-3 text-sm rounded-lg flex items-center gap-2 font-medium ${error.includes('생성되었습니다') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${error.includes('생성되었습니다') ? 'bg-green-500' : 'bg-red-500'}`} />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-[#081429] text-white rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                                    {isSignUp ? '가입하기' : '로그인'}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={toggleMode}
                            className="text-sm font-bold text-[#fdb813] hover:underline"
                        >
                            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
