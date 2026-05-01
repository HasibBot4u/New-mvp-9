import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
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
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-background-elevated rounded-xl shadow-sm border border-border p-8 max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h2 className="text-xl font-bold text-foreground mb-2 font-bangla">
              দুঃখিত, একটি সমস্যা হয়েছে
            </h2>
            <p className="text-foreground-muted mb-8 font-bangla">
              অ্যাপ্লিকেশন লোড করতে একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজটি রিলোড করুন।
            </p>

            <Button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center space-x-2 font-bangla"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>রিলোড করুন</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
