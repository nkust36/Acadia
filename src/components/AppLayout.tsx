import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Users, Globe, User } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: LayoutDashboard, label: "看板" },
  { path: "/feed", icon: Users, label: "動態" },
  { path: "/add", icon: PlusCircle, label: "記帳" },
  { path: "/plaza", icon: Globe, label: "廣場" },
  { path: "/profile", icon: User, label: "我的" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            const isAdd = tab.path === "/add";
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                  isAdd ? "" : isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isAdd ? (
                  <div className="gradient-warm rounded-full p-2.5 -mt-5 shadow-elevated">
                    <tab.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                ) : (
                  <tab.icon className="w-5 h-5" />
                )}
                <span className={`text-[10px] font-medium ${isAdd ? "mt-0" : ""}`}>
                  {tab.label}
                </span>
                {isActive && !isAdd && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
