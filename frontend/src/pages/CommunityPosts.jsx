import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Layout/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ReactionBar from "@/components/ReactionBar";
import { MessageSquare, ChevronDown, ChevronRight, Trash2, Send } from "lucide-react";

export default function CommunityPosts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user, refreshUser } = useAuth();
  const API = getApiUrl();
  const { toast } = useToast();

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentTextById, setCommentTextById] = useState({});
  const [forbidden, setForbidden] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState(()=>new Set()); // track which posts have comments open

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Load community details (existing endpoint)
        const cRes = await fetch(`${API}/api/communities/${id}`);
        const cJson = await cRes.json().catch(() => ({}));
        if (!cRes.ok) {
          toast({ title: "Not found", description: cJson.message || "Community not found" });
          navigate("/communities");
          return;
        }
        if (mounted) setCommunity(cJson.community || null);

        // Fetch posts using explicit id-based endpoint to avoid collisions
        const targetId = cJson.community?._id || id;
        const pRes = await fetch(`${API}/api/communities/id/${targetId}/posts`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const pJson = await pRes.json().catch(() => ({}));
        if (!mounted) return;
        if (pRes.ok) {
          setPosts(pJson.posts || []);
          setForbidden(false);
        } else if (pRes.status === 403) {
          setForbidden(true);
        } else {
          toast({ title: "Load failed", description: pJson.message || `HTTP ${pRes.status}` });
        }
      } catch (e) {
        toast({ title: "Load failed", description: "Unable to load community" });
        navigate("/communities");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [API, id, token]);

  const joinNow = async () => {
    if (!token) { toast({ title: "Login required", description: "Please log in to join" }); navigate("/login"); return; }
    try {
      const res = await fetch(`${API}/api/communities/${id}/join`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
      });
      const j = await res.json();
      if (res.ok) {
        toast({ title: "Joined", description: `You joined ${j.community?.name}` });
        try { await refreshUser?.(); } catch {}
        const targetId = j.community?._id || id;
        const pRes = await fetch(`${API}/api/communities/id/${targetId}/posts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (pRes.ok) setPosts((await pRes.json()).posts || []);
        setForbidden(false);
      } else {
        toast({ title: "Join failed", description: j.message || "Unable to join" });
      }
    } catch (e) {
      toast({ title: "Join failed", description: e?.message || String(e) });
    }
  };

  const currentUserId = String(user?._id || user?.id || "");

  const toggleComments = (postId) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const addComment = async (post) => {
    const content = commentTextById[post._id] || "";
    if (!content.trim()) return;
    if (!token) { toast({ title: "Login required", description: "Please log in to comment" }); return; }
    try {
      const res = await fetch(`${API}/api/posts/${post._id}/comment`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const json = await res.json();
      if (res.ok) {
        setPosts(prev => prev.map(p => String(p._id) === String(json.post._id) ? json.post : p));
        setCommentTextById(prev => ({ ...prev, [post._id]: "" }));
        if (!expandedPosts.has(post._id)) toggleComments(post._id); // auto open on first comment
      } else {
        toast({ title: "Comment failed", description: json.message || "Unable to comment" });
      }
    } catch (e) {
      toast({ title: "Comment failed", description: e?.message || String(e) });
    }
  };

  const deleteComment = async (post, c) => {
    const isOwner = currentUserId && String(c.authorId) === currentUserId;
    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';
    if (!isOwner && !isAdmin) { toast({ title: "Not allowed", description: "You cannot delete this comment" }); return; }
    try {
      const res = await fetch(`${API}/api/posts/${post._id}/comment/${c._id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok) {
        setPosts(prev => prev.map(p => String(p._id) === String(json.post._id) ? json.post : p));
      } else {
        toast({ title: "Delete failed", description: json.message || "Unable to delete" });
      }
    } catch (e) {
      toast({ title: "Delete failed", description: e?.message || String(e) });
    }
  };

  // in component top, compute absolute cover URL
  const backendBase = (API && String(API).replace(/\/api\/?$/, '')) || window.location.origin;
  const coverUrl = community?.coverUrl ? (String(community.coverUrl).match(/^https?:\/\//i) ? community.coverUrl : backendBase + (community.coverUrl.startsWith('/') ? '' : '/') + community.coverUrl) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{community?.name || "Community"}</h1>
            <p className="text-sm text-muted-foreground">{community?.description || community?.category || ""}</p>
          </div>
          <div>
            <Button variant="ghost" onClick={() => navigate("/communities")}>Back</Button>
          </div>
        </div>

        {/* {coverUrl && (
          <div className="mb-4">
            <img src={coverUrl} alt={`${community?.name} cover`} className="w-full h-44 object-cover rounded-lg border community-cover" />
          </div>
        )} */}

        {loading && <div>Loading...</div>}

        {(!loading && forbidden) && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Join to view posts</div>
                <div className="text-sm text-muted-foreground">You must join this community to see its posts.</div>
              </div>
              <Button onClick={joinNow}>Join Now</Button>
            </div>
          </Card>
        )}

        {(!loading && !forbidden) && (
          <div className="space-y-4">
            {Array.isArray(posts) && posts.length > 0 ? posts.map((post) => {
              const open = expandedPosts.has(post._id);
              const commentCount = (post.comments || []).length;
              return (
                <div
                  key={post._id || post.id}
                  className={`border rounded-lg p-3 ${post.validationStatus === 'validated' ? 'post-validated' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-full">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{post.title}</p>
                        {post.validationStatus === 'validated' && post.editedBy && (
                          <span className="text-xs text-green-700">by {post.editedBy}</span>
                        )}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</div>
                      {!!post.imageUrl && (
                        <img
                          className="mt-2 rounded max-h-64 object-cover border"
                          src={post.imageUrl}
                          alt=""
                        />
                      )}
                      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                        <ReactionBar
                          post={post}
                          API={API}
                          token={token}
                          userId={currentUserId}
                          onUpdated={(updated) =>
                            setPosts(prev => prev.map(p => String(p._id) === String(updated._id) ? updated : p))
                          }
                          onLoginRequired={() => toast({ title: "Login required", description: "Please log in to react" })}
                        />
                        <Button variant="ghost" size="sm" onClick={() => toggleComments(post._id || post.id)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {commentCount > 0 ? `${commentCount} Replies` : 'Reply'}
                          {open ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
                        </Button>
                      </div>
                      {open && (
                        <div className="mt-4 border-t pt-3 space-y-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Write a reply..."
                              value={commentTextById[post._id] || ""}
                              onChange={(e) => setCommentTextById(prev => ({ ...prev, [post._id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  addComment(post);
                                }
                              }}
                            />
                            <Button size="sm" onClick={() => addComment(post)}>
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-auto pr-1">
                            {(post.comments || []).map((c) => {
                              // show delete for owner or admin
                              const isOwner = !!currentUserId && String(c?.authorId && (c.authorId._id || c.authorId)) === currentUserId;
                              const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';
                              return (
                                <div key={c._id} className="group rounded-lg px-3 py-2 bg-muted/40 border flex justify-between items-start">
                                  <div className="text-sm flex-1">
                                    <div className="font-medium">{c.authorName}</div>
                                    <div className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</div>
                                    <div className="mt-1 whitespace-pre-wrap">{c.content}</div>
                                  </div>
                                  {(isOwner || isAdmin) && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => deleteComment(post, c)}
                                      aria-label="Delete comment"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                            {commentCount === 0 && (
                              <div className="text-xs text-muted-foreground">No replies yet.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <Card className="p-8 text-center text-muted-foreground">No posts yet</Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}