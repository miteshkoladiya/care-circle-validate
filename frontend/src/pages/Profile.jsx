import React from "react";
import { Navbar } from "@/components/Layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl, fetchJson } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user: ctxUser, token, refreshUser } = useAuth();
  const { toast } = useToast();
  const [user, setUser] = useState(ctxUser || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const API = getApiUrl();
  const navigate = useNavigate();

  const load = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const json = await fetchJson(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(json.user || null);
    } catch (err) {
      console.error('Failed to load profile', err);
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!user) return setDraft(null);
    setDraft({
      name: user.name || '',
      avatar: user.avatar || '',
      age: user.age ?? '',
      contactNumber: user.contactNumber || '',
      registrationNumber: user.registrationNumber || ''
    });
  }, [user]);

  const save = async () => {
    if (!token) return toast({ title: 'Login required', description: 'Sign in to update your profile.' });
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(draft) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return toast({ title: 'Save failed', description: json.message || `Status ${res.status}` });
      setUser(json.user || user);
      if (refreshUser) await refreshUser();
      toast({ title: 'Profile updated' });
      setEditing(false);
    } catch (err) {
      console.error('Save profile failed', err);
      toast({ title: 'Network error', description: 'Could not update profile' });
    } finally { setLoading(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6">
          <Card className="p-6 text-center">
            <CardTitle>Please sign in</CardTitle>
            <CardDescription>You must be signed in to view your profile.</CardDescription>
            <div className="mt-4">
              <Button onClick={() => navigate("/login")}>Sign in</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardHeader className="flex items-start gap-4 p-6">
            <Avatar className="h-20 w-20">
              {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : <AvatarFallback className="text-2xl">{(user.name || "").split(" ").map(n=>n[0]).join("")}</AvatarFallback>}
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-3">
                  {editing ? (
                    <input className="text-2xl font-semibold bg-transparent border-b" value={draft?.name||''} onChange={e=>setDraft({...draft, name:e.target.value})} />
                  ) : (
                    <h2 className="text-2xl font-semibold">{user.name}</h2>
                  )}
                  <Badge>{user.role}</Badge>
                  {user.isVerified && <Badge variant="secondary">Verified</Badge>}
                </div>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            </div>
            <div>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={save} disabled={loading}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(user ? { name: user.name || '', avatar: user.avatar || '', age: user.age ?? '', contactNumber: user.contactNumber || '', registrationNumber: user.registrationNumber || '' } : null); }}>Cancel</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate('/settings')} disabled>Settings</Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <div className="text-xs text-muted-foreground">Age</div>
                  <div className="font-medium">{editing ? <input className="w-full border-b bg-transparent" value={draft?.age||''} onChange={e=>setDraft({...draft, age: e.target.value})} /> : (user.age ?? "N/A")}</div>
              </div>
              <div>
                  <div className="text-xs text-muted-foreground">Contact</div>
                  <div className="font-medium">{editing ? <input className="w-full border-b bg-transparent" value={draft?.contactNumber||''} onChange={e=>setDraft({...draft, contactNumber: e.target.value})} /> : (user.contactNumber || "N/A")}</div>
              </div>
              <div>
                  <div className="text-xs text-muted-foreground">Registration</div>
                  <div className="font-medium">{editing ? <input className="w-full border-b bg-transparent" value={draft?.registrationNumber||''} onChange={e=>setDraft({...draft, registrationNumber: e.target.value})} /> : (user.registrationNumber || "N/A")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Communities</div>
                <div className="font-medium">
                  {Array.isArray(user.communities) && user.communities.length > 0
                    ? user.communities.slice(0,5).map(c => <div key={c._id || c} className="truncate"><a className="text-primary hover:underline" href={`/communities/${c._id||c}`}>{c.name || c}</a></div>)
                    : "None"}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">About</h3>
              <div className="text-sm text-muted-foreground">
                {/* placeholder for profile bio / more fields */}
                Profile information is shown above. If you want editing enabled, I can add inline edit controls.
              </div>
            </div>

            <div className="flex gap-2 justify-between items-center">
              <div className="text-sm text-muted-foreground">{loading ? 'Refreshing...' : error ? `Error: ${error}` : ''}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => load()}>Refresh</Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}