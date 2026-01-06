import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
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
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-8 text-center">
                    <h1 className="text-3xl font-bold text-red-600 mb-4">
                        오류가 발생했습니다 (Something went wrong)
                    </h1>
                    <div className="bg-gray-100 p-6 rounded-lg max-w-2xl w-full overflow-auto text-left shadow-inner">
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Error Message:</h2>
                        <pre className="text-red-500 font-mono mb-4 whitespace-pre-wrap break-words">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Component Stack:</h2>
                        <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap overflow-x-auto">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        페이지 새로고침 (Reload)
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
