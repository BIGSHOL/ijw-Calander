import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Error Boundary Component
 * Addresses Issue #18: Better error handling
 * 
 * Features:
 * - Catches JavaScript errors in child components
 * - Displays user-friendly error messages
 * - Provides recovery options (reload, go home)
 * - Logs errors for debugging
 */

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
        
        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
        
        // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    }

    public render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 p-8">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        {/* Error Message */}
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            앗! 문제가 발생했어요
                        </h1>
                        <p className="text-gray-600 mb-6">
                            죄송합니다. 예상치 못한 오류가 발생했습니다.<br />
                            페이지를 새로고침하거나 홈으로 돌아가 주세요.
                        </p>

                        {/* Error Details (collapsible) */}
                        {this.state.error && (
                            <details className="text-left mb-6">
                                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">
                                    오류 상세 정보
                                </summary>
                                <div className="mt-2 p-4 bg-gray-50 rounded border border-gray-200">
                                    <p className="text-xs font-mono text-red-600 mb-2">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <pre className="text-xs text-gray-600 overflow-auto max-h-40">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                            >
                                <Home size={18} />
                                홈으로
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition font-medium"
                            >
                                <RefreshCw size={18} />
                                새로고침
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
