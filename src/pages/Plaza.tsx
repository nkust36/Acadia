import { motion } from "framer-motion";
import { MessageSquare, TrendingUp, Clock, Globe } from "lucide-react";

const plazaItems = [
  {
    id: 1,
    anonymous: "匿名鱷魚 🐊",
    time: "2 分鐘前",
    category: "購物",
    amount: "NT$ 15,000",
    memo: "衝動買了一台遊戲機...",
    comments: 23,
    hot: true,
  },
  {
    id: 2,
    anonymous: "匿名貓頭鷹 🦉",
    time: "15 分鐘前",
    category: "餐飲",
    amount: "NT$ 4,500",
    memo: "請全部門吃下午茶",
    comments: 45,
    hot: true,
  },
  {
    id: 3,
    anonymous: "匿名企鵝 🐧",
    time: "30 分鐘前",
    category: "交通",
    amount: "NT$ 890",
    memo: "打車回家因為太懶走路",
    comments: 8,
    hot: false,
  },
  {
    id: 4,
    anonymous: "匿名松鼠 🐿️",
    time: "1 小時前",
    category: "娛樂",
    amount: "NT$ 6,200",
    memo: "手遊課金了...不要告訴我老婆",
    comments: 67,
    hot: true,
  },
  {
    id: 5,
    anonymous: "匿名水母 🪼",
    time: "2 小時前",
    category: "購物",
    amount: "NT$ 280",
    memo: "第三杯奶茶了今天",
    comments: 12,
    hot: false,
  },
];

export default function Plaza() {
  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">全球消費廣場</h1>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-5">看看別人都花了甚麼錢</p>

      {/* Hot Tags */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {[" 熱門", "大額", "餐飲", "娛樂", "購物"].map((tag) => (
          <button
            key={tag}
            className="bg-card shadow-card px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {plazaItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.06 * i }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{item.anonymous}</p>
                {item.hot && (
                  <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                    🔥 熱門
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="text-[10px]">{item.time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{item.category}</span>
              <span className="font-bold text-sm text-destructive">{item.amount}</span>
            </div>

            <p className="text-sm mb-3">{item.memo}</p>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <MessageSquare className="w-4 h-4" />
                {item.comments} 則留言
              </button>
              <button className="text-xs text-primary font-medium">公審一下 →</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
