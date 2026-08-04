import { fetchGeneralSettings } from "@/lib/public-api";
import { AuthBanner } from "@/components/auth-banner";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const settings = await fetchGeneralSettings();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <AuthBanner settings={settings} />
        <div className="p-8">
          <h1 className="mb-6 text-lg font-semibold text-zinc-900">Đăng nhập</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
