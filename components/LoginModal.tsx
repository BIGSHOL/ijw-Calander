import React, { useState } from 'react';
import { X, Lock, LogIn } from 'lucide-react';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            onClose();
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential') {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else {
                setError('로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-0 relative overflow-hidden border border-gray-200">

                {/* Header */}
                <div className="bg-[#081429] p-6 text-center">
                    <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <Lock size={32} className="text-[#fdb813]" />
                    </div>
                    <h2 className="text-xl font-bold text-white">관리자 로그인</h2>
                    <p className="text-blue-200 text-sm mt-1">일정 관리 시스템에 접속합니다.</p>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">이메일</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#081429] focus:ring-2 focus:ring-[#081429]/10 outline-none transition-all font-medium"
                                placeholder="admin@example.com"
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

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
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
                                    <LogIn size={20} />
                                    로그인
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
