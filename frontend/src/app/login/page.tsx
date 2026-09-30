import { Button } from '@/components/ui/Button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ReachInbox</h1>
          <p className="mt-2 text-sm text-gray-600">
            Email Scheduler for High-Volume Campaigns
          </p>
        </div>
        <div className="mt-8">
          <a href={`${API_URL}/auth/google`}>
            <Button className="w-full" size="lg">
              Sign in with Google
            </Button>
          </a>
          <p className="mt-4 text-xs text-center text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
