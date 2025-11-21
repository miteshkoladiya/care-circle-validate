import React, { useEffect, useState } from "react";
import { Navbar } from "@/components/Layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function Validation() {
  const { user, token } = useAuth();
  const API = getApiUrl();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const canDoctor = user && user.role === 'Doctor';
  const canAdmin = user && (user.role === 'Admin' || user.role === 'SuperAdmin');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/posts/validation-feed`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      let json = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems(json.posts || []);
      } else if (res.status === 404) {
        // Fallback depending on role: doctors use /api/posts/pending, admins use /api/admin/posts/pending
        const fallbackEndpoint = canAdmin ? `${API}/api/admin/posts/pending` : `${API}/api/posts/pending`;
        const r2 = await fetch(fallbackEndpoint, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok) setItems(j2.posts || []);
        else toast({ title: 'Load failed', description: j2.message || `HTTP ${r2.status} at ${fallbackEndpoint}` });
      } else {
        toast({ title: 'Load failed', description: json.message || `HTTP ${res.status} at /api/posts/validation-feed` });
      }
    } catch (e) {
      toast({ title: 'Load failed', description: e?.message || String(e) });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [API, token]);

  const beginEdit = (p) => { setEditId(p._id || p.id); setEditTitle(p.title || ''); setEditContent(p.content || ''); };
  const cancelEdit = () => { setEditId(null); setEditTitle(''); setEditContent(''); };

  const saveEdit = async () => {
    try {
      const res = await fetch(`${API}/api/posts/${editId}`, { method: 'PUT', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: editTitle, content: editContent }) });
      const json = await res.json();
      if (res.ok) {
        setItems(prev => prev.map(x => String(x._id||x.id)===String(editId) ? json.post : x));
        toast({ title: 'Saved', description: json.post.title });
        cancelEdit();
      } else {
        toast({ title: 'Save failed', description: json.message || 'Unable to save' });
      }
    } catch (e) { toast({ title: 'Save failed', description: e?.message || String(e) }); }
  };

  const validatePost = async (p, status) => {
    try {
      const res = await fetch(`${API}/api/posts/${p._id || p.id}/validate`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const json = await res.json();
      if (res.ok) {
        setItems(prev => prev.map(x => String(x._id||x.id)===String(p._id||p.id) ? json.post : x).filter(x => (x.validationStatus==='pending' || x.validationStatus==='validated')));
        toast({ title: status === 'validated' ? 'Validated' : 'Rejected', description: json.post.title });
      } else {
        toast({ title: 'Validation failed', description: json.message || 'Unable to update' });
      }
    } catch (e) { toast({ title: 'Validation failed', description: e?.message || String(e) }); }
  };

  const approvePost = async (p) => {
    try {
      const res = await fetch(`${API}/api/posts/${p._id || p.id}/approve`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (res.ok) {
        setItems(prev => prev.filter(x => String(x._id||x.id)!==String(p._id||p.id)));
        toast({ title: 'Approved & Published', description: json.post.community });
      } else {
        toast({ title: 'Approve failed', description: json.message || 'Unable to approve' });
      }
    } catch (e) { toast({ title: 'Approve failed', description: e?.message || String(e) }); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Validation</h1>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-3">
            {items.map(p => (
              <Card
                key={p._id || p.id}
                className={`p-3 ${p.validationStatus === 'validated' ? 'post-validated' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="pr-4">
                    {editId === (p._id || p.id) ? (
                      <div className="space-y-2">
                        <input className="w-full border rounded px-2 py-1" value={editTitle} onChange={e=>setEditTitle(e.target.value)} />
                        <Textarea value={editContent} onChange={e=>setEditContent(e.target.value)} />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
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
                        <div className="text-sm text-muted-foreground">
                          {p.timeOfDay || ''} • {new Date(p.createdAt).toLocaleString()} • {p.validationStatus}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.content}</div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    {(canDoctor && p.validationStatus === 'pending') && (
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => validatePost(p, 'validated')}>Validate</Button>
                        <Button size="sm" variant="destructive" onClick={() => validatePost(p, 'rejected')}>Reject</Button>
                      </div>
                    )}
                    {(canAdmin && (p.validationStatus === 'validated' || p.validationStatus === 'pending')) && (
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => approvePost(p)}>Approve & Publish</Button>
                        {p.validationStatus === 'pending' && (
                          <Button size="sm" variant="destructive" onClick={() => validatePost(p, 'rejected')}>Reject</Button>
                        )}
                      </div>
                    )}
                    {(canDoctor || canAdmin) && editId !== (p._id || p.id) && (
                      <Button size="sm" variant="secondary" onClick={() => beginEdit(p)}>Edit</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {items.length === 0 && (
              <div className="text-muted-foreground">No items to review.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
