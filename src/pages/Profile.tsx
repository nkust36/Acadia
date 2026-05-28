import { motion } from "framer-motion";
import { Shield, Settings, ChevronRight, LogOut, Search, MessageCircle, Bell, Moon, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";

const menuItems = [
  { icon: Search, label: "搜尋好友 (ID)", desc: "用專屬 ID 加好友" },
  { icon: MessageCircle, label: "聊天室", desc: "一對一訊息" },
  { icon: Bell, label: "通知設定", desc: "管理推播與提醒" },
  { icon: Shield, label: "隱私與安全", desc: "資料保護設定" },
  { icon: Moon, label: "深色模式", desc: "切換顯示主題" },
  { icon: HelpCircle, label: "幫助中心", desc: "常見問題" },
];

const stats = [
  { label: "記帳天數", value: "128" },
  { label: "好友", value: "15" },
  { label: "公開紀錄", value: "42" },
];

export default function Profile() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("已登出");
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      {/* User Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card rounded-2xl p-5 shadow-card mb-5"
      >
        <div className="flex items-center gap-4 mb-4">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover shadow-elevated"
            />
          ) : (
            <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center text-3xl shadow-elevated">
              🌮
            </div>
          )}
          <div className="flex-1">
            <h2 className="font-bold text-lg">{user?.name ?? "匿名旅者"}</h2>
            <p className="text-xs text-muted-foreground">{user?.email ?? "ID: SLP-8492-XK"}</p>
            <div className="flex items-center gap-1 mt-1">
              <Shield className="w-3 h-3 text-success" />
              <span className="text-[10px] text-success font-medium">
                {user?.emailVerified ? "Google 已驗證" : "匿名保護中"}
              </span>
            </div>
          </div>
          <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="text-center py-2 bg-muted/50 rounded-xl">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Personal Info Banner */}
      <div className="bg-accent/10 rounded-xl p-3 mb-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium">系統不主動收集真實姓名或電話</p>
          <p className="text-[10px] text-muted-foreground">你的隱私由匿名原則保護</p>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        {menuItems.map((item, i) => (
          <motion.button
            key={item.label}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.05 * i }}
            className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0"
          >
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full mt-5 mb-8 flex items-center justify-center gap-2 py-3 text-destructive text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        登出帳號
      </button>
    </div>
  );
}
