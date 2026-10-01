import { Button } from '@/components/ui/Button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-5">
      <div className="w-full max-w-[360px] rounded-2xl border border-[#e6ece8] bg-white p-8 shadow-[0_14px_45px_rgba(32,37,34,0.06)]">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-[#202522] text-white grid place-items-center text-xl font-bold">O</div>
          <h1 className="text-2xl font-bold tracking-tight text-[#202522]">Welcome back</h1>
          <p className="mt-2 text-sm text-[#7a8580]">Sign in to manage your email campaigns</p>
        </div>
        <div className="mt-8">
          <a href={`${API_URL}/auth/google`}>
            <Button className="w-full" size="lg">
              <span className="mr-2">G</span> Continue with Google
            </Button>
          </a>
          <p className="mt-5 text-[11px] leading-5 text-center text-[#9aa49f]">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
