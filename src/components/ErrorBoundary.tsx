import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4 text-center">
          <h1 className="text-2xl font-bold mb-2">একটি সমস্যা দেখা দিয়েছে</h1>
          <p className="text-gray-600 mb-6">
            একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন।
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre className="p-4 bg-gray-100 text-red-600 text-xs rounded border mb-6 max-w-xl overflow-auto text-left w-full font-mono">
              {this.state.error.message}
            </pre>
          )}
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
            onClick={() => window.location.reload()}
          >
            পৃষ্ঠা রিফ্রেশ করুন
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
