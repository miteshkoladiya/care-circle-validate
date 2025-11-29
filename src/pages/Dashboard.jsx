import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Users, MessageSquare, Heart, Activity, Plus, TrendingUp, /* Calendar, */ Award, CheckCircle, Clock } from "lucide-react";
import { Navbar } from "@/components/Layout/Navbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { initSocketClient } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user, token } = useAuth();
  const API = getApiUrl();
  const [communities, setCommunities] = useState([]);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cRes = await fetch(`${API}/api/communities`);
        const cJson = await cRes.json();
        setCommunities(cJson.communities || []);

        const pRes = await fetch(`${API}/api/posts`);
        const pJson = await pRes.json();
        // merge persisted local placeholders so navigation doesn't lose them
        try {
          const key = `carecircle:localPosts:${(user && (user._id || user.id)) || 'anon'}`;
          const persisted = JSON.parse(localStorage.getItem(key) || '[]');
          const serverPosts = pJson.posts || [];
          // filter out server duplicates of local placeholders
          const filteredLocal = (persisted || []).filter(lp => !serverPosts.find(sp => sp.title === lp.title && sp.authorName === lp.authorName && Math.abs(new Date(sp.createdAt) - new Date(lp.createdAt)) < 60000));
          setRecentQuestions([...filteredLocal, ...serverPosts].slice(0, 50));
        } catch (e) {
          setRecentQuestions(pJson.posts || []);
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Load failed", description: "Unable to load dashboard data" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [API, token]);

  // realtime: update recentQuestions when new posts are created/published by server
  useEffect(() => {
    try {
      const base = API.replace(/\/api\/?$/, "") || window.location.origin;
      const s = initSocketClient(base);
      const onNewPost = (post) => {
        // prepend and cap list to 50
        setRecentQuestions((prev) => {
          if (!post) return prev;
          // remove any local placeholder that matches this server post (by title/author/time)
          try {
            const key = `carecircle:localPosts:${(user && (user._id || user.id)) || 'anon'}`;
            const persisted = JSON.parse(localStorage.getItem(key) || '[]') || [];
            const remaining = persisted.filter(lp => !(lp.title === post.title && lp.authorName === post.authorName && Math.abs(new Date(lp.createdAt) - new Date(post.createdAt)) < 60000));
            localStorage.setItem(key, JSON.stringify(remaining.slice(0,50)));
          } catch (e) { /* ignore */ }
          const exists = prev.find(p => String(p._id || p.id) === String(post._id || post.id) || (p.__local && p.title === post.title && p.authorName === post.authorName));
          if (exists) {
            // if exists and it's a local placeholder, replace it with authoritative server post
            if (exists.__local) {
              return [post, ...prev.filter(p => !(p.__local && p.title === post.title && p.authorName === post.authorName))].slice(0,50);
            }
            return prev;
          }
          return [post, ...prev].slice(0, 50);
        });
      };
      s.on("post:created", onNewPost);
      s.on("post:published", onNewPost);
      s.on("post:ai_created", onNewPost);
      return () => { s.off("post:created", onNewPost); s.off("post:published", onNewPost); s.off("post:ai_created", onNewPost); };
    } catch (err) {
      // socket failure shouldn't break dashboard
      console.debug("socket init failed", err);
    }
  }, [API]);

  // local synthetic posts dispatched by components (e.g., ChatWidget) — show immediately
  useEffect(() => {
    const onLocal = (e) => {
      const post = e?.detail;
      if (!post) return;
      setRecentQuestions(prev => {
        // avoid duplicate by title/author
        const exists = prev.find(p => (p.__local && p._id === post._id) || (p.title === post.title && p.authorName === post.authorName && Math.abs(new Date(p.createdAt) - new Date(post.createdAt)) < 60000));
        if (exists) return prev;
        return [post, ...prev].slice(0, 50);
      });
    };
    window.addEventListener('carecircle:post-created', onLocal);
    return () => window.removeEventListener('carecircle:post-created', onLocal);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const role = user?.role;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(" ")[0]}!</h1>
            <p className="text-muted-foreground mt-1">Here's what's happening in your healthcare communities today.</p>
          </div>
          {/* patient ask button removed: global ChatWidget is the single assistant entrypoint */}
          {(role === "Admin" || role === "SuperAdmin") && (
            <Button className="flex items-center space-x-2" onClick={() => window.location.assign('/admin?tab=communities')}><Plus className="h-4 w-4" /><span>Create Community</span></Button>
          )}
        </div>

    {role === "Patient" && <PatientDashboard communities={communities} recentQuestions={recentQuestions} />}
        {role === "Doctor" && <DoctorDashboard recentQuestions={recentQuestions} />}
        {(role === "Admin" || role === "SuperAdmin") && (<AdminDashboard communities={communities} recentQuestions={recentQuestions} token={token} api={API} />)}
      </div>
    </div>
  );
}

function PatientDashboard({ communities, recentQuestions }) {
  const { user, token } = useAuth();
  const API = getApiUrl();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ reactions: 0, comments: 0 });

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/posts/user-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
         if(data) setStats({ reactions: data.reactions || 0, comments: data.comments || 0 });
      })
      .catch(err => console.error(err));
  }, [API, token]);
  // modal-based post view removed; navigation to /communities/:id is used
  // const [selectedCommunity, setSelectedCommunity] = useState(null);
  // const [posts, setPosts] = useState([]);
  // const [loadingPosts, setLoadingPosts] = useState(false);

  // only show communities the patient has joined
  const joinedIds = new Set((user?.communities || []).map((id) => String(id)));
  const joinedCommunities = communities.filter((c) => joinedIds.has(String(c._id || c.id)));

  const openCommunity = async (community) => {
    const id = community._id || community.id;
    if (!id) return;
    const isJoined = (user?.communities || []).map(x => String(x)).includes(String(id));
    if (!isJoined) {
      toast({ title: "Join required", description: "Join the community to view posts" });
      return;
    }
    navigate(`/communities/${id}`);
  };

  // Removed modal Dialog code: posts are shown on separate page

  // dynamic patient stats
  const userId = String(user?._id || user?.id || "");
  const communitiesCount = joinedCommunities.length;
  const userName = user?.name || "";
  const userPosts = useMemo(() => (recentQuestions || []).filter(q => {
    // server-side authored posts with id or nested id
    const rawAuthorId = q?.authorId || q?.author || (q?.authorId && q.authorId._id) || (q?.author && q.author._id) || "";
    const authorId = rawAuthorId ? String(rawAuthorId) : "";
    const authorName = String(q.authorName || q.userName || q.author?.name || "");
    // include local placeholders dispatched from ChatWidget (__local) which include authorName
    if (q.__local && authorName && userName && authorName === userName) return true;
    // include posts where authorName matches full user name (some posts may not include authorId)
    if (authorName && userName && authorName === userName) return true;
    // include posts where authorId matches user's id
    if (authorId && userId && String(authorId) === String(userId)) return true;
    return false;
  }), [recentQuestions, userId, userName]);
  const questionsAskedCount = userPosts.length;


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Communities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{communitiesCount}</div>
            <p className="text-xs text-muted-foreground">Active memberships</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions Asked</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{questionsAskedCount}</div>
            <p className="text-xs text-muted-foreground">Total questions you asked</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reactions</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reactions}</div>
            <p className="text-xs text-muted-foreground">Total reactions you made</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.comments}</div>
            <p className="text-xs text-muted-foreground">Total comments you posted</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>My Communities</CardTitle>
            <CardDescription>Communities you've joined</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {joinedCommunities.length === 0 && (
                <div className="col-span-1 text-sm text-muted-foreground">You haven't joined any communities yet.</div>
              )}
                  {joinedCommunities.map((community) => (
                    <div key={community._id || community.id} className="p-3 border rounded-lg hover:shadow hover:bg-muted transition-colors cursor-pointer" onClick={() => openCommunity(community)}>
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback>{(community.name || "").split(" ").map(n => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{community.name}</p>
                            {/* <Badge variant="secondary" className="ml-2">{(community.dailyPosts ?? 0)} new</Badge> */}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">{community.description ?? community.category ?? "No description"}</p>
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">{community.members ?? 0} members</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity removed */}
      </div>
      {/* Posts Dialog for selected community */}
      {/* {selectedCommunity && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) closeCommunity(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedCommunity.name} — Posts</DialogTitle>
              <DialogDescription className="mb-2">Showing recent posts in this community.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-auto">
              {loadingPosts && <div className="p-4">Loading posts...</div>}
              {!loadingPosts && posts.length === 0 && <div className="p-4 text-sm text-muted-foreground">No posts yet.</div>}
              {!loadingPosts && posts.map((p) => (
                <div key={p._id || p.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.title}</p>
                      <div className="mt-2 text-sm">{p.content}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => closeCommunity()}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )} */}
    </div>
  );
}

function DoctorDashboard({ recentQuestions }) {
  const { token } = useAuth();
  const API = getApiUrl();
  const { toast } = useToast();
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState({ validatedCount: 0 });

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/posts/doctor-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
         if(data) setStats({ validatedCount: data.validatedCount || 0 });
      })
      .catch(err => console.error(err));
  }, [API, token]);

  useEffect(() => {
    async function loadPending() {
      try {
        const res = await fetch(`${API}/api/posts/pending`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (res.ok) setPending(json.posts || []);
      } catch (err) { console.error(err); }
    }
    loadPending();
  }, [API, token]);

  useEffect(() => {
    const base = API.replace(/\/api\/?$/, "") || window.location.origin;
    const s = initSocketClient(base);
    const onAi = (post) => setPending(prev => [post, ...prev]);
    const onValidated = (data) => setPending(prev => prev.filter(p => String(p._id) !== String(data.postId)));
    s.on("post:ai_created", onAi);
    s.on("post:validated", onValidated);
    return () => { s.off("post:ai_created", onAi); s.off("post:validated", onValidated); };
  }, [API]);

  const approve = async (id) => {
    try {
      const res = await fetch(`${API}/api/posts/${id}/validate`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ status: "validated" }) });
      const json = await res.json();
      if (res.ok) { toast({ title: "Validated", description: json.post.title }); setPending(prev => prev.filter(p => String(p._id) !== String(json.post._id))); }
      else { toast({ title: "Validate failed", description: json.message || "Unable to validate" }); }
    } catch (err) { toast({ title: "Validate failed", description: err?.message || String(err) }); }
  };

  const reject = async (id) => {
    try {
      const res = await fetch(`${API}/api/posts/${id}/validate`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected" }) });
      const json = await res.json();
      if (res.ok) { toast({ title: "Rejected", description: json.post.title }); setPending(prev => prev.filter(p => String(p._id) !== String(json.post._id))); }
      else { toast({ title: "Reject failed", description: json.message || "Unable to reject" }); }
    } catch (err) { toast({ title: "Reject failed", description: err?.message || String(err) }); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending AI Posts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting your review</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validated This Week</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.validatedCount}</div>
            <p className="text-xs text-muted-foreground">Posts you validated</p>
          </CardContent>
        </Card>

        {/* Removed Average Response Time card */}
        {/* Keep Expert Endorsements */}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Pending AI-generated Posts</CardTitle>
            <CardDescription>Review and validate posts generated by the AI assistant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pending.map((post) => (
                <div
  key={post._id}
  className={`border rounded-lg p-3 ${post.validationStatus === 'validated' ? 'post-validated' : ''}`}
>
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm">{post.title}</p>
        {post.validationStatus === 'validated' && post.editedBy && (
          <span className="text-xs text-green-700">by {post.editedBy}</span>
        )}
      </div>
      <div className="mt-2 text-sm">{post.content}</div>
    </div>
    <div className="flex flex-col items-end space-y-2">
      <Button size="sm" onClick={() => approve(post._id)}>Validate</Button>
      <Button size="sm" variant="destructive" onClick={() => reject(post._id)}>Reject</Button>
    </div>
  </div>
</div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Removed Recent Questions card */}
      </div>
    </div>
  );
}

function AdminDashboard({ communities, recentQuestions, token, api }) {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const { toast } = useToast();
  // preview modal state
  const [previewDoc, setPreviewDoc] = useState(null); // { id, url }
  // track which doctors were viewed (string IDs)
  const [viewedDocs, setViewedDocs] = useState(new Set());
  // reject modal state
  const [rejectingDoctor, setRejectingDoctor] = useState(null); // id string
  const [rejectReason, setRejectReason] = useState("");

  const API = api;

  // load pending doctors (you probably already have something like this)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/admin/users`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (res.ok) {
          // filter pending doctors (role=Doctor, isVerified=false)
          const list = (json.users || []).filter(
            (u) => String(u.role).toLowerCase() === "doctor" && !u.isVerified
          );
          setPendingDoctors(list);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [API, token]);

  // build absolute URL to doctorDocument and open preview dialog
  const openDocPreview = (doctor) => {
    try {
      const backendBase = (API && String(API).trim()) || window.location.origin;
      const base = String(backendBase).replace(/\/api\/?$/, "").replace(/\/$/, "");
      const doc = doctor?.doctorDocument ? String(doctor.doctorDocument).trim() : "";
      if (!doc) {
        toast({ title: "No document", description: "No doctor document available" });
        return;
      }
      const url = /^https?:\/\//i.test(doc)
        ? doc
        : `${base}${doc.startsWith("/") ? "" : "/"}${doc}`;

      const idStr = String(doctor._id || doctor.id);
      setPreviewDoc({ id: idStr, url });

      // mark as viewed so Approve button is enabled
      setViewedDocs((prev) => {
        const s = new Set(Array.from(prev).map(String));
        s.add(idStr);
        return s;
      });
    } catch (e) {
      console.error("openDocPreview failed", e);
      toast({ title: "Preview failed", description: e?.message || String(e) });
    }
  };

  const closePreview = () => setPreviewDoc(null);

  // approve doctor (requires viewedDocs has id)
  const approveDoctor = async (id) => {
    const idStr = String(id);
    try {
      const res = await fetch(`${API}/api/admin/users/${idStr}/approve`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Doctor approved",
          description: json.user?.name
            ? `${json.user.name} has been verified.`
            : "Doctor verified.",
        });
        setPendingDoctors((prev) =>
          (prev || []).filter((d) => String(d._id || d.id) !== idStr)
        );
      } else {
        toast({
          title: "Approve failed",
          description: json.message || `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      toast({ title: "Approve failed", description: e?.message || String(e) });
    }
  };

  // open reject modal
  const startReject = (id) => {
    setRejectingDoctor(String(id));
    setRejectReason("");
  };

  // confirm reject from modal
  const confirmReject = async () => {
    const id = String(rejectingDoctor || "");
    const reason = (rejectReason || "").trim();
    setRejectingDoctor(null);

    if (!id) return;

    try {
      const res = await fetch(`${API}/api/admin/users/${id}/reject`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Doctor rejected",
          description: json.message || "Doctor account removed.",
        });
        setPendingDoctors((prev) =>
          (prev || []).filter((d) => String(d._id || d.id) !== id)
        );
      } else {
        toast({
          title: "Reject failed",
          description: json.message || `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      toast({ title: "Reject failed", description: e?.message || String(e) });
    }
  };

  // cancel reject modal
  const cancelReject = () => {
    setRejectingDoctor(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctor Verifications -> cap height and make scrollable so it doesn't expand */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Doctor Verifications</CardTitle>
            <CardDescription>Pending doctor accounts requiring approval</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-auto p-4 space-y-3"> {/* <-- capped height */}
              {pendingDoctors.map((d) => (
                <div key={d._id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8"><AvatarFallback>{(d.name || "").split(" ").map(n=>n[0]).join("")}</AvatarFallback></Avatar>
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.doctorDocument && (
                      <Button size="sm" onClick={() => openDocPreview(d)}>View</Button>
                    )}
                    <Button size="sm" onClick={() => approve(d._id)} disabled={!viewedDocs.has(d._id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => startReject(d._id)}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Communities card -> keep independent scroll if many */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Communities</CardTitle>
            <CardDescription>Manage communities and settings</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-auto p-4 space-y-3"> {/* <-- capped height */}
              {communities.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.category} • {c.members || 0} members</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => window.location.assign(`/admin?tab=communities&editId=${c._id || c.id}`)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeCommunity(c._id || c.id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Doctor document</DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="mt-2">
              {/* Try to show in iframe; if browser can't, it still shows as link */}
              <iframe
                src={previewDoc.url}
                title="Doctor document"
                className="w-full h-96 border rounded"
              />
              <div className="mt-2 text-xs">
                If the document does not render, you can{" "}
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  open it in a new tab
                </a>.
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog
        open={!!rejectingDoctor}
        onOpenChange={(open) => {
          if (!open) cancelReject();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject doctor</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Optionally provide a reason for rejecting this doctor account:
            </p>
            <Textarea
              rows={3}
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={cancelReject}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
