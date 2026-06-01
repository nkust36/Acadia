import { motion } from "framer-motion";
import { ArrowLeft, Shield, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getUserProfileByUid, updateUserProfileFields, type UserProfile } from "@/lib/social";

type PrivacyForm = {
  hideFriendIdFromOthers: boolean;
  hideBudgetStatusFromOthers: boolean;
  hidePieChartFromOthers: boolean;
  hideDailyAverageFromOthers: boolean;
};

const defaultForm: PrivacyForm = {
  hideFriendIdFromOthers: false,
  hideBudgetStatusFromOthers: false,
  hidePieChartFromOthers: false,
  hideDailyAverageFromOthers: false,
};

export default function PrivacySettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<PrivacyForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    setLoading(true);

    getUserProfileByUid(user.id)
      .then((nextProfile) => {
        if (!active) return;

        if (!nextProfile) {
          toast.error("找不到你的個人資料，請重新登入後再試。");
          navigate("/profile", { replace: true });
          return;
        }

        setProfile(nextProfile);
        setForm({
          hideFriendIdFromOthers: nextProfile.hideFriendIdFromOthers,
          hideBudgetStatusFromOthers: nextProfile.hideBudgetStatusFromOthers,
          hidePieChartFromOthers: nextProfile.hidePieChartFromOthers,
          hideDailyAverageFromOthers: nextProfile.hideDailyAverageFromOthers,
        });
      })
      .catch(() => {
        if (active) {
          toast.error("載入隱私設定失敗，請稍後再試。");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, user]);

  const handleToggle = (key: keyof PrivacyForm) => {
    setForm((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      await updateUserProfileFields(user.id, form);
      toast.success("隱私設定已更新。");
      navigate("/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新失敗，請稍後再試。";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-12">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-11 w-11 rounded-full bg-card shadow-card flex items-center justify-center"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">隱私與安全</h1>
          <p className="text-sm text-muted-foreground">控制別人能在你的個人檔案看到哪些資訊</p>
        </div>
      </div>

      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-3xl shadow-card border border-border/60 p-5 md:p-6"
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">載入中...</div>
        ) : (
          <div className="space-y-4">
            {[
              {
                key: "hideFriendIdFromOthers" as const,
                title: "向別人隱藏我的 ID",
                desc: "別人查看你的個人檔案時，不會看到你的好友 ID。",
              },
              {
                key: "hideBudgetStatusFromOthers" as const,
                title: "向別人隱藏超支 / 未超支狀態",
                desc: "別人查看你的個人檔案時，不會看到你目前是否超支。",
              },
              {
                key: "hidePieChartFromOthers" as const,
                title: "向別人隱藏圓餅圖分析",
                desc: "別人查看你的個人檔案時，不會看到最近 30 天的分類分析。",
              },
              {
                key: "hideDailyAverageFromOthers" as const,
                title: "向別人隱藏每日平均花費",
                desc: "別人查看你的個人檔案時，不會看到你的每日平均花費。",
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={form[item.key]} onCheckedChange={() => handleToggle(item.key)} disabled={saving} />
              </div>
            ))}

            <div className="rounded-2xl bg-muted/30 border border-border/60 p-4 text-sm text-muted-foreground flex items-start gap-3">
              <EyeOff className="h-4 w-4 mt-0.5 shrink-0" />
              <p>這些設定只影響其他人查看你的個人檔案時看到的內容，你自己仍然可以在自己的頁面上看到完整資訊。</p>
            </div>

            <div className="flex gap-3">
              <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "儲存中..." : "儲存設定"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/profile") } disabled={saving}>
                取消
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}