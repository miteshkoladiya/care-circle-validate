import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Layout/Navbar";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { initSocketClient } from "@/lib/socket";

export default function Admin() {
  const { token, user } = useAuth();
  const API = getApiUrl();
  const [users, setUsers] = useState([]);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [aiTitle, setAiTitle] = useState("");
  const [aiContent, setAiContent] = useState("");
  const [aiCommunity, setAiCommunity] = useState("");
  const [pendingPosts, setPendingPosts] = useState([]);
  const [tab, setTab] = useState("users");
  const [communities, setCommunities] = useState([]);
  // inline edit state for pending posts (replace old prompt-based edit)
  const [editPostId, setEditPostId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // add state for photo file
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    // check query params for tab (e.g. /admin?tab=communities) and editId
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('tab');
      const editId = params.get('editId');
      if (q) setTab(q);
      if (editId) {
        setEditingId(editId);
        // try to prefill once communities load below
      }
    } catch (err) { /* ignore */ }

    async function load() {
      try {
        const res = await fetch(`${API}/api/admin/users`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (res.ok) setUsers(json.users || []);
        try {
          // posts pending endpoint lives under /api/posts
          // Align with Validation page: use unified validation feed (pending + validated, unpublished)
          const r2 = await fetch(`${API}/api/posts/validation-feed`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const j2 = await r2.json();
          if (r2.ok) setPendingPosts(j2.posts || []);
          else {
            // fallback to legacy /pending if validation-feed not available
            const r2b = await fetch(`${API}/api/posts/pending`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            const j2b = await r2b.json();
            if (r2b.ok) setPendingPosts(j2b.posts || []);
          }
        } catch (err) { console.error(err); }
        try {
          const r3 = await fetch(`${API}/api/communities`);
          const j3 = await r3.json();
          if (r3.ok) {
            setCommunities(j3.communities || []);
            // if editingId is present, prefill form
            try {
              const params = new URLSearchParams(window.location.search);
              const editId = params.get('editId');
              if (editId) {
                const target = (j3.communities || []).find(c => (c._id === editId || c.id === editId));
                if (target) {
                  setName(target.name || '');
                  setCategory(target.category || '');
                  setDescription(target.description || '');
                }
              }
            } catch (err) { /* ignore */ }
          }
        } catch (err) { console.error(err); }
      } catch (err) {
        console.error(err);
        toast({ title: "Load failed", description: "Unable to load users" });
      }
    }
    load();
  }, [API, token]);

  useEffect(() => {
    const base = API.replace(/\/api\/?$/, "") || window.location.origin;
    const s = initSocketClient(base);
    const onAi = (post) => setPendingPosts(prev => [post, ...prev]);
    const onValidated = (data) => {
      const { postId, status } = data || {};
      if (!postId || !status) return;
      setPendingPosts(prev => prev.map(p => String(p._id || p.id) === String(postId) ? { ...p, validationStatus: status } : p));
    };
    const onPublished = (post) => {
      if (!post?._id) return;
      setPendingPosts(prev => prev.filter(p => String(p._id || p.id) !== String(post._id)));
    };
    s.on("post:ai_created", onAi);
    s.on("post:validated", onValidated);
    s.on("post:published", onPublished);
    return () => {
      s.off("post:ai_created", onAi);
      s.off("post:validated", onValidated);
      s.off("post:published", onPublished);
    };
  }, [API]);

  const changeRole = async (id, role) => {
    try {
      const res = await fetch(`${API}/api/admin/users/${id}/role`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const json = await res.json();
      if (res.ok) {
        setUsers(u => u.map(x => (x._id===id||x.id===id)?json.user:x));
        toast({ title: "Role updated", description: `${json.user.name} is now ${json.user.role}` });
      } else {
        toast({ title: "Update failed", description: json.message || "Unable to change role" });
      }
    } catch (err) { toast({ title: "Update failed", description: err?.message || String(err) }); }
  };

  const deleteCommunity = async (id) => {
    try {
      const res = await fetch(`${API}/api/communities/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" } });
      const text = await res.text().catch(() => null);
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore non-json */ }
      if (res.ok) {
        setCommunities(prev => prev.filter(c => c._id !== id && c.id !== id));
        toast({ title: "Deleted", description: "Community removed" });
      } else {
        console.error('[admin] DELETE /api/communities/:id failed', { status: res.status, body: text });
        const message = json?.message || json?.error || text || `HTTP ${res.status}`;
        toast({ title: "Delete failed", description: message });
      }
    } catch (err) {
      console.error('[admin] deleteCommunity error', err);
      toast({ title: "Delete failed", description: err?.message || String(err) });
    }
  };

  // helper: upload photo after create/update
  async function uploadCommunityPhoto(communityId) {
    if (!photoFile) return null;
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      const res = await fetch(`${API}/api/communities/${communityId}/photo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}, // DO NOT set Content-Type here
        body: fd
      });
      const j = await res.json();
      if (res.ok) {
        // update local communities list with returned community (fresh coverUrl)
        setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === String(communityId) ? j.community : c)));
        setPhotoFile(null);
        toast({ title: 'Photo uploaded', description: 'Community cover updated' });
        return j.community;
      } else {
        toast({ title: 'Upload failed', description: j.message || 'Unable to upload photo' });
        return null;
      }
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message || String(err) });
      return null;
    }
  }

  // helper: delete community photo
  async function deleteCommunityPhoto(communityId) {
    // deletion confirmation is handled by modal in the UI; this function performs the delete
    try {
      const res = await fetch(`${API}/api/communities/${communityId}/photo`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await res.text().catch(() => null);
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch (e) { /* non-json response */ }
      if (res.ok) {
        const community = j?.community || null;
        if (community) setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === String(communityId) ? community : c)));
        toast({ title: 'Photo removed', description: 'Community cover has been deleted' });
        return community;
      } else {
        console.error('[admin] DELETE /communities/:id/photo failed', { status: res.status, body: text });
        const message = j?.message || j?.error || text || `HTTP ${res.status}`;
        toast({ title: 'Delete failed', description: message });
        return null;
      }
    } catch (err) {
      console.error('[admin] deleteCommunityPhoto error', err);
      toast({ title: 'Delete failed', description: err?.message || String(err) });
      return null;
    }
  }

  const createCommunity = async () => {
    try {
      if (editingId) {
        // update existing
        const res = await fetch(`${API}/api/communities/${editingId}`, { method: "PUT", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, category }) });
        const json = await res.json();
        if (res.ok) {
          // update local list
          setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === String(editingId) ? json.community : c)));
          toast({ title: "Updated", description: json.community.name });
          // upload photo if selected
          if (photoFile) await uploadCommunityPhoto(editingId);
          setName(""); setDescription(""); setCategory(""); setEditingId(null);
        } else {
          toast({ title: "Update failed", description: json.message || "Unable to update" });
        }
      } else {
        // create new community
        const res = await fetch(`${API}/api/communities`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, category }) });
        const json = await res.json();
        if (res.ok) {
          // add to local list
          setCommunities(prev => [json.community, ...(prev || [])]);
          toast({ title: "Community created", description: json.community.name });
          // upload photo if selected
          if (photoFile) {
            const updated = await uploadCommunityPhoto(json.community._id || json.community.id);
            if (updated) {
              // ensure local state contains updated community with coverUrl
              setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === String(updated._id || updated.id) ? updated : c)));
            }
          }
          setName(""); setDescription(""); setCategory("");
        } else {
          toast({ title: "Create failed", description: json.message || "Unable to create" });
        }
      }
    } catch (err) { toast({ title: "Create failed", description: err?.message || String(err) }); }
  };

  const validatePost = async (id, status) => {
    try {
      const res = await fetch(`${API}/api/posts/${id}/validate`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const json = await res.json();
      if (res.ok) {
        setPendingPosts(prev => prev.filter(p => String(p._id) !== String(json.post._id)));
        toast({ title: status === "validated" ? "Approved" : "Rejected", description: json.post.title });
      } else {
        toast({ title: "Action failed", description: json.message || "Unable to update" });
      }
    } catch (err) { toast({ title: "Action failed", description: err?.message || String(err) }); }
  };

  const approvePostAdmin = async (id) => {
    try {
      const res = await fetch(`${API}/api/posts/${id}/approve`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" } });
      const json = await res.json();
      if (res.ok) {
        setPendingPosts(prev => prev.filter(p => String(p._id) !== String(json.post._id)));
        toast({ title: "Approved & Published", description: json.post.title });
      } else {
        toast({ title: "Approve failed", description: json.message || "Unable to approve" });
      }
    } catch (err) { toast({ title: "Approve failed", description: err?.message || String(err) }); }
  };
  const beginEditPost = (post) => {
    setEditPostId(post._id || post.id);
    setEditTitle(post.title || "");
    setEditContent(post.content || "");
  };
  const cancelEditPost = () => {
    setEditPostId(null);
    setEditTitle("");
    setEditContent("");
  };
  const saveEditPost = async () => {
    if (!editPostId) return;
    try {
      const res = await fetch(`${API}/api/posts/${editPostId}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, content: editContent }) });
      const json = await res.json();
      if (res.ok) {
        setPendingPosts(prev => prev.map(p => String(p._id) === String(json.post._id) ? json.post : p));
        toast({ title: 'Updated', description: json.post.title });
        cancelEditPost();
      } else {
        toast({ title: 'Edit failed', description: json.message || 'Unable to edit' });
      }
    } catch (e) { toast({ title: 'Edit failed', description: e?.message || String(e) }); }
  };

  const [generating, setGenerating] = useState(false);
  const [lastGenResponse, setLastGenResponse] = useState(null);
  const generateNow = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/admin/generate-now`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok) { toast({ title: 'Generation failed', description: json?.error || `HTTP ${res.status}` }); setGenerating(false); return; }
      const jobId = json.jobId;
      if (!jobId) { toast({ title: 'Generation failed', description: 'No jobId returned' }); setGenerating(false); return; }

      // poll job status until done; stop polling if user navigates away or unmounts
      let mounted = true;
      const pollInterval = 1500;
      const poll = async () => {
        try {
          const s = await fetch(`${API}/api/admin/generate-status/${jobId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          const j = await s.json().catch(()=>({}));
          if (!mounted) return;
          if (s.ok && j.state === 'done') {
            setPendingPosts(prev => [...(j.result?.created || []), ...(prev || [])]);
            setLastGenResponse(JSON.stringify(j.result || {}, null, 2));
            setGenerating(false);
            return;
          }
          if (s.ok && j.state === 'running') {
            // optionally show progress counts
            setLastGenResponse(JSON.stringify({ running: true, partial: j.result || {} }, null, 2));
          }
        } catch (e) {
          // ignore transient errors
        }
        if (mounted) setTimeout(poll, pollInterval);
      };
      poll();

      // stop loading when user navigates away or closes tab
      const stopPolling = () => { mounted = false; setGenerating(false); };
      window.addEventListener('beforeunload', stopPolling);
      const unblock = history.listen(() => stopPolling());
      // cleanup when done/unmount
      const cleanup = () => { mounted = false; window.removeEventListener('beforeunload', stopPolling); unblock(); setGenerating(false); };
      // clear on component unmount
      // store cleanup reference to be used in useEffect cleanup (not shown here)
    } catch (err) {
      toast({ title: "Generation failed", description: String(err) });
      setGenerating(false);
    }
  };

  const approve = async (id) => {
    try {
      const res = await fetch(`${API}/api/admin/users/${id}/approve`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" } });
      const json = await res.json();
      if (res.ok) {
        toast({ title: "Approved", description: `${json.user.name} is verified` });
        setUsers((u) => u.map((item) => (item._id === id || item.id === id ? json.user : item)));
      } else {
        toast({ title: "Approve failed", description: json.message || "Unable to approve" });
      }
    } catch (err) {
      toast({ title: "Approve failed", description: err?.message || String(err) });
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`${API}/api/admin/users/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" } });
      const json = await res.json();
      if (res.ok) {
        toast({ title: "Deleted", description: "User removed" });
        setUsers((u) => u.filter((item) => item._id !== id && item.id !== id));
      } else {
        toast({ title: "Delete failed", description: json.message || "Unable to delete" });
      }
    } catch (err) {
      toast({ title: "Delete failed", description: err?.message || String(err) });
    }
  };

  // Add helper to begin editing an existing community (prefill the Create form)
  const beginEditCommunity = (c) => {
    if (!c) return;
    setEditingId(c._id || c.id);
    setName(c.name || "");
    setCategory(c.category || "");
    setDescription(c.description || "");
    // update URL so Admin can bookmark/share edit state
    try { window.history.replaceState(null, "", `/admin?tab=communities&editId=${c._id || c.id}`); } catch (e) {}
  };

  // safe reference to currently editing community for UI (avoid 'current is not defined')
  const current = (editingId && (communities || []).find(c => String(c._id || c.id) === String(editingId))) || null;

  // delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'photo'|'community', id, name }

  const openDeleteModal = (type, id, name) => {
    setDeleteTarget({ type, id, name });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      if (type === 'photo') {
        await deleteCommunityPhoto(id);
      } else if (type === 'community') {
        await deleteCommunity(id);
      }
    } finally {
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Admin</h1>
        <div className="mb-4">
          <div className="flex space-x-2">
            <Button variant={tab === 'users' ? undefined : 'ghost'} onClick={() => setTab('users')}>Users</Button>
            <Button variant={tab === 'communities' ? undefined : 'ghost'} onClick={() => setTab('communities')}>Create Community</Button>
            <Button variant={tab === 'posts' ? undefined : 'ghost'} onClick={() => setTab('posts')}>Posts</Button>
            {user && (user.role === 'Admin' || user.role === 'SuperAdmin') && (
              <Button variant="secondary" onClick={generateNow} disabled={generating}>{generating ? 'Generating...' : 'Generate Now'}</Button>
            )}
          </div>
          {lastGenResponse && (
            <div className="mt-3">
              <div className="bg-slate-50 border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Generation debug response</div>
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={async () => {
                      try { await navigator.clipboard.writeText(lastGenResponse); toast({ title: 'Copied', description: 'Response copied to clipboard' }); } catch (e) { toast({ title: 'Copy failed', description: String(e) }); }
                    }}>Copy</Button>
                    <Button size="sm" variant="ghost" onClick={() => setLastGenResponse(null)}>Clear</Button>
                  </div>
                </div>
                <pre className="text-xs overflow-auto max-h-48 p-2 bg-white border rounded">{lastGenResponse}</pre>
              </div>
            </div>
          )}
        </div>


        {tab === 'users' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Users</h2>
            <div className="grid grid-cols-1 gap-4">
              {users.map((u) => (
                <Card key={u._id || u.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarFallback>{(u.name || "").split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-sm text-muted-foreground">{u.email} • {u.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select value={u.role} onChange={(e) => changeRole(u._id || u.id, e.target.value)} className="border rounded px-2 py-1">
                      <option value="Patient">Patient</option>
                      <option value="Doctor">Doctor</option>
                      <option value="Admin">Admin</option>
                      <option value="SuperAdmin">SuperAdmin</option>
                    </select>
                    {u.role === "Doctor" && !u.isVerified && (
                      <Button size="sm" onClick={() => approve(u._id || u.id)}>Approve</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => remove(u._id || u.id)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'communities' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Create Community</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <Card className="p-4">
                <CardHeader>
                  <CardTitle>Create Community</CardTitle>
                  <CardDescription>Add a new community visible to users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                    <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <div className="mt-2">
                      <label className="block text-sm text-muted-foreground mb-1">Cover photo</label>
                      <input type="file" accept="image/*" onChange={(e)=>setPhotoFile(e.target.files?.[0] || null)} />
                      {editingId && photoFile && <div className="text-xs text-muted-foreground mt-1">New photo selected: {photoFile.name}</div>}
                      {editingId && current?.coverUrl && (
                        <div className="flex items-center gap-2 mt-2">
                          <img src={(current.coverUrl && current.coverUrl.match(/^https?:\/\//)) ? current.coverUrl : `${API.replace(/\/api\/?$/, '')}${current.coverUrl}`} alt="cover" className="h-12 w-20 object-cover rounded border community-cover-sm" />
                          <Button size="sm" variant="destructive" onClick={() => openDeleteModal('photo', editingId, current?.name)}>Delete photo</Button>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 mt-2">
                      <Button onClick={createCommunity}>{editingId ? "Update" : "Create"}</Button>
                      <Button variant="ghost" onClick={() => { setName(""); setCategory(""); setDescription(""); setEditingId(null); window.history.replaceState(null, "", "/admin?tab=communities"); }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h3 className="text-md font-medium mb-2">Existing</h3>
                <div className="space-y-2">
                  {communities.map(c => (
                    <Card key={c._id || c.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-muted-foreground">{c.category} • {c.members || 0} members</div>
                      </div>
                        <div className="flex space-x-2">
                        <Button size="sm" onClick={() => beginEditCommunity(c)}>Edit</Button> {/* <-- new Edit button */}
                        <Button size="sm" variant="destructive" onClick={() => openDeleteModal('community', c._id || c.id, c.name)}>Delete</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'posts' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Pending AI Posts</h2>
            <div className="space-y-3">
              {pendingPosts.map(p => (
                <Card
                  key={p._id || p.id}
                  className={`p-3 ${p.validationStatus === 'validated' ? 'post-validated' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="pr-4 w-full">
                      {editPostId === (p._id || p.id) ? (
                        <div className="space-y-2">
                          <input
                            className="w-full border rounded px-2 py-1"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            placeholder="Title"
                          />
                          <Textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={5}
                            placeholder="Content"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEditPost}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditPost}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{p.title}</div>
                            {p.validationStatus === 'validated' && p.editedBy && (
                              <span className="text-xs text-green-700">by {p.editedBy}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.timeOfDay || ''} • {new Date(p.createdAt).toLocaleString()} • {p.validationStatus}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap">{p.content}</div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      {user && (user.role === 'Doctor') && (
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => validatePost(p._id || p.id, 'validated')}>Validate</Button>
                          <Button size="sm" variant="destructive" onClick={() => validatePost(p._id || p.id, 'rejected')}>Reject</Button>
                        </div>
                      )}

                      {user && (user.role === 'Admin' || user.role === 'SuperAdmin') && (
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2">
                            <Button size="sm" onClick={() => approvePostAdmin(p._id || p.id)}>Approve & Publish</Button>
                            {editPostId !== (p._id || p.id) && (
                              <Button size="sm" variant="secondary" onClick={() => beginEditPost(p)}>Edit</Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => validatePost(p._id || p.id, 'rejected')}>Reject</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        {/* Delete confirmation modal */}
        {deleteModalOpen && deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h3 className="text-lg font-medium mb-2">Confirm delete</h3>
              <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteTarget.type === 'photo' ? 'the cover photo' : `the community "${deleteTarget.name || ''}"` }? This action cannot be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
