import { fetchGeneralSettings } from "@/lib/public-api";
import { AuthBanner } from "@/components/auth-banner";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage() {
  const settings = await fetchGeneralSettings();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <AuthBanner settings={settings} />
        <div className="p-8">
          <h1 className="mb-6 text-lg font-semibold text-zinc-900">Đăng ký</h1>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
