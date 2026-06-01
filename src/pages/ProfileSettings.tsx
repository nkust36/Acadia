import { motion } from "framer-motion";
import { ArrowLeft, Camera, Save, Trash2, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImageFile } from "@/lib/image";
import { firebaseAuth } from "@/lib/firebase";
import { getUserProfileByUid, updateUserProfileFields, type UserGender, type UserProfile } from "@/lib/social";
import { updateProfile } from "firebase/auth";

type ProfileForm = {
  name: string;
  age: string;
  gender: UserGender;
};

const genderOptions: Array<{ value: UserGender; label: string }> = [
  { value: "prefer_not_to_say", label: "不公開" },
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "其他" },
];

const nameCooldownDays = 14;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date) {
  return value.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getNameCooldown(profile: UserProfile | null) {
  if (!profile) {
    return null;
  }

  const baseDate = parseDate(profile.nameUpdatedAt ?? profile.createdAt);
  if (!baseDate) {
    return null;
  }

  const nextAllowedDate = new Date(baseDate.getTime() + nameCooldownDays * millisecondsPerDay);
  const remainingMs = nextAllowedDate.getTime() - Date.now();

  return {
    nextAllowedDate,
    isLocked: remainingMs > 0,
    remainingDays: Math.max(0, Math.ceil(remainingMs / millisecondsPerDay)),
  };
}

async function prepareProfilePhoto(dataUrl: string) {
  return dataUrl;
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, refreshUserProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialNameRef = useRef<string>("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({ name: "", age: "", gender: "prefer_not_to_say" });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    setLoading(true);
    getUserProfileByUid(user.id)
      .then((nextProfile) => {
        if (!active) {
          return;
        }

        if (!nextProfile) {
          toast.error("找不到你的個人資料，請重新登入後再試。");
          navigate("/profile", { replace: true });
          return;
        }

        setProfile(nextProfile);
        initialNameRef.current = nextProfile.name.trim();
        setForm({
          name: nextProfile.name,
          age: typeof nextProfile.age === "number" ? String(nextProfile.age) : "",
          gender: nextProfile.gender ?? "prefer_not_to_say",
        });
        setPhotoPreview(nextProfile.picture ?? null);
        setPhotoDataUrl(null);
        setRemovePhoto(false);
      })
      .catch(() => {
        if (active) {
          toast.error("載入個人資料失敗，請稍後再試。");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [navigate, user]);

  const nameCooldown = useMemo(() => getNameCooldown(profile), [profile]);

  const currentPicture = removePhoto ? null : photoPreview ?? profile?.picture ?? user?.picture ?? null;
  const canEditName = !nameCooldown?.isLocked;

  const handleFieldChange = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleGenderSelect = (gender: UserGender) => {
    setForm((current) => ({ ...current, gender }));
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("請選擇圖片檔案。");
      return;
    }

    setProcessingPhoto(true);

    try {
      const dataUrl = await compressImageFile(file);
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
      setRemovePhoto(false);
    } catch {
      toast.error("圖片處理失敗，請再試一次。");
    } finally {
      setProcessingPhoto(false);
      event.target.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoDataUrl(null);
    setRemovePhoto(true);
  };

  const handleSave = async () => {
    if (!user || !profile) {
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("請輸入名稱。");
      return;
    }

    const nameChanged = trimmedName !== initialNameRef.current;

    if (nameChanged && nameCooldown?.isLocked) {
      toast.error(`名稱修改後需等待 ${nameCooldownDays} 天，還要 ${nameCooldown.remainingDays} 天才能再次更改。`);
      return;
    }

    const trimmedAge = form.age.trim();
    const ageValue = trimmedAge === "" ? undefined : Number(trimmedAge);

    if (trimmedAge !== "" && (!Number.isInteger(ageValue) || ageValue < 0 || ageValue > 150)) {
      toast.error("請輸入有效年齡。");
      return;
    }

    setSaving(true);

    try {
      let nextPicture = profile.picture;

      if (removePhoto) {
        nextPicture = undefined;
      }

      if (photoDataUrl) {
        nextPicture = await prepareProfilePhoto(photoDataUrl);
      }

      const now = new Date().toISOString();

      await updateUserProfileFields(user.id, {
        name: trimmedName,
        picture: nextPicture,
        gender: form.gender,
        age: ageValue,
        updatedAt: now,
        ...(nameChanged ? { nameUpdatedAt: now } : {}),
      });

      if (firebaseAuth.currentUser) {
        await updateProfile(firebaseAuth.currentUser, {
          displayName: trimmedName,
        });
      }

      await refreshUserProfile();
      initialNameRef.current = trimmedName;
      toast.success("個人資料已更新。");
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
          <h1 className="text-2xl font-bold">個人資料設定</h1>
          <p className="text-sm text-muted-foreground">修改名稱、照片、性別與年齡</p>
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
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl bg-muted/40 p-4 border border-border/60">
                <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl bg-background shadow-elevated">
                  {currentPicture ? (
                    <img src={currentPicture} alt={form.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <UserCircle2 className="h-12 w-12" />
                      <span className="text-xs">尚未設定照片</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={saving || processingPhoto}>
                    <Camera className="h-4 w-4" />
                    {processingPhoto ? "處理中..." : "更換照片"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleRemovePhoto} disabled={saving || processingPhoto || !currentPicture}>
                    <Trash2 className="h-4 w-4" />
                    移除照片
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-muted/30 border border-border/60 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">名稱限制</p>
                <p>名稱修改後需要等待 {nameCooldownDays} 天才能再次更改。</p>
                {nameCooldown?.isLocked ? (
                  <p className="mt-2 text-xs">下次可更改時間：{formatDate(nameCooldown.nextAllowedDate)}（剩餘 {nameCooldown.remainingDays} 天）</p>
                ) : (
                  <p className="mt-2 text-xs">目前可以修改名稱。</p>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium">名稱</span>
                  <Input
                    value={form.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    placeholder="輸入你的名稱"
                    disabled={saving}
                    readOnly={!canEditName}
                  />
                  {!canEditName ? (
                    <p className="text-xs text-muted-foreground">名稱還在冷卻中，僅能查看目前名稱。</p>
                  ) : null}
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">年齡</span>
                  <Input
                    type="number"
                    min="0"
                    max="150"
                    inputMode="numeric"
                    value={form.age}
                    onChange={(event) => handleFieldChange("age", event.target.value)}
                    placeholder="例如 28"
                    disabled={saving}
                  />
                </label>

                <div className="block space-y-2">
                  <span className="text-sm font-medium">性別</span>
                  <div className="grid grid-cols-2 gap-2">
                    {genderOptions.map((option) => {
                      const selected = form.gender === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleGenderSelect(option.value)}
                          className={`rounded-2xl border px-3 py-3 text-sm font-medium transition-all ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground shadow-elevated"
                              : "border-border bg-background hover:border-primary/40"
                          }`}
                          disabled={saving}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/30 border border-border/60 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs">電子郵件</p>
                    <p className="font-medium break-all">{profile?.email || user.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">好友 ID</p>
                    <p className="font-medium tracking-[0.2em]">{profile?.friendId ?? user.friendId}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="button" onClick={handleSave} disabled={saving || processingPhoto || loading} className="flex-1">
                  <Save className="h-4 w-4" />
                  {saving ? "儲存中..." : "儲存變更"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/profile")} disabled={saving || processingPhoto}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}