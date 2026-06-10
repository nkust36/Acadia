import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const redirectPath = (location.state as RedirectState | null)?.from?.pathname || "/";

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success("登入成功，歡迎回來！");
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google 登入失敗，請再試一次。";
      toast.error(message);
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "register" && formData.password !== formData.confirmPassword) {
      toast.error("兩次輸入的密碼不一致。");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "register") {
        await registerWithEmail(formData.name, formData.email, formData.password);
        toast.success("註冊成功，已自動登入。");
      } else {
        await loginWithEmail(formData.email, formData.password);
        toast.success("登入成功，歡迎回來！");
      }

      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失敗，請再試一次。";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!formData.email.trim()) {
      toast.error("請先輸入電子郵件再重設密碼。");
      return;
    }

    setIsSendingReset(true);
    try {
      await resetPassword(formData.email);
      toast.success("重設密碼信已寄出，請檢查信箱。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "無法寄送重設信件。";
      toast.error(message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 gradient-cool">
      <div className="w-full max-w-md rounded-3xl bg-card/95 backdrop-blur p-7 shadow-elevated border border-border/70">
        <div className="w-14 h-14 rounded-2xl gradient-warm flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-primary-foreground" />
        </div>

        <h1 className="text-2xl font-bold mb-2">登入</h1>
        <br />
        

        <div className="mb-6 rounded-2xl border border-border bg-muted/30 p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Email 登入
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            註冊新帳號
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleEmailSubmit}>
          {mode === "register" && (
            <label className="block space-y-2">
              <span className="text-sm font-medium">顯示名稱</span>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="你的名字"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-medium">電子郵件</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={formData.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">密碼</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="至少 6 個字元"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label className="block space-y-2">
              <span className="text-sm font-medium">確認密碼</span>
              <input
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                placeholder="再次輸入密碼"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                autoComplete="new-password"
                required
              />
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
          >
            {isSubmitting ? "處理中..." : mode === "register" ? "建立帳號" : "登入"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>或</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-muted/40"
        >
          使用 Google 登入
        </button>

        

        <button
          type="button"
          onClick={handleResetPassword}
          disabled={isSendingReset}
          className="mt-3 w-full text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
        >
          {isSendingReset ? "寄送中..." : "忘記密碼？寄送重設信"}
        </button>

    
      </div>
    </div>
  );
}
