import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";

const feedItems = [
  {
    user: "好友A 🐱",
    avatar: "🐱",
    time: "10 分鐘前",
    category: "餐飲",
    amount: "NT$ 320",
    memo: "跟同事吃了豪華拉麵",
    mood: "😊",
    likes: 5,
    comments: 2,
    color: "bg-primary/10",
  },
  {
    user: "好友B 🦊",
    avatar: "🦊",
    time: "1 小時前",
    category: "購物",
    amount: "NT$ 2,990",
    memo: "忍不住買了限量球鞋...",
    mood: "😅",
    likes: 12,
    comments: 8,
    color: "bg-warning/10",
  },
  {
    user: "好友C 🐻",
    avatar: "🐻",
    time: "3 小時前",
    category: "娛樂",
    amount: "NT$ 580",
    memo: "電影院約會",
    mood: "😍",
    likes: 20,
    comments: 5,
    color: "bg-plaza/10",
  },
  {
    user: "你 🎭",
    avatar: "🎭",
    time: "5 小時前",
    category: "咖啡",
    amount: "NT$ 85",
    memo: "下午需要咖啡因續命",
    mood: "😐",
    likes: 3,
    comments: 1,
    color: "bg-accent/10",
  },
];

export default function Feed() {
  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">好友動態</h1>
      </div>

      <div className="space-y-4">
        {feedItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 * i }}
            className="bg-card rounded-2xl p-4 shadow-card"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center text-lg`}>
                  {item.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.user}</p>
                  <p className="text-[10px] text-muted-foreground">{item.time}</p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
                  {item.category}
                </span>
                <span>{item.mood}</span>
              </div>
              <p className="font-bold text-destructive">{item.amount}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{item.memo}</p>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <button className="flex items-center gap-1 text-muted-foreground text-xs">
                <Heart className="w-4 h-4" />
                {item.likes}
              </button>
              <button className="flex items-center gap-1 text-muted-foreground text-xs">
                <MessageCircle className="w-4 h-4" />
                {item.comments}
              </button>
              <button className="flex items-center gap-1 text-muted-foreground text-xs ml-auto">
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
