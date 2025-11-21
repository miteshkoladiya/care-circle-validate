import React from "react";
import { Button } from "@/components/ui/button";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "helpful", emoji: "✅", label: "Helpful" },
  { type: "insight", emoji: "💡", label: "Insight" },
  { type: "support", emoji: "🙌", label: "Support" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
];

export default function ReactionBar({ post, API, token, userId, onUpdated, onLoginRequired }) {
  const reactions = Array.isArray(post?.reactions) ? post.reactions : [];

  const counts = REACTIONS.reduce((acc, r) => {
    acc[r.type] = reactions.filter(x => x.type === r.type).length;
    return acc;
  }, {});

  const hasReacted = (type) => reactions.some(r => String(r.by) === String(userId) && r.type === type);

  const toggleReact = async (type) => {
    if (!token) { onLoginRequired && onLoginRequired(); return; }
    try {
      const res = await fetch(`${API}/api/posts/${post._id || post.id}/react`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const json = await res.json();
      if (res.ok) {
        // prefer server post (ensures consistency) and counts computed server-side if needed
        onUpdated && onUpdated(json.post, json.counts);
      }
    } catch (e) {
      // no-op
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-2">
      {REACTIONS.map(r => {
        const count = counts[r.type] || 0;
        const showCount = count > 0; // hide zero counts
        return (
          <Button
            key={r.type}
            size="sm"
            variant={hasReacted(r.type) ? 'default' : 'ghost'}
            onClick={() => toggleReact(r.type)}
            className="h-8 px-2"
            aria-label={`${r.label}${showCount ? ` (${count})` : ''}`}
          >
            <span className="mr-1" aria-hidden>{r.emoji}</span>
            {showCount && <span className="text-xs">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}
