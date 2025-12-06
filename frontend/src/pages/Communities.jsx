import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, MessageSquare, TrendingUp, Plus, Trash2, Heart, UserPlus } from "lucide-react";
import { Navbar } from "@/components/Layout/Navbar";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { initSocketClient } from "@/lib/socket";
import ReactionBar from "@/components/ReactionBar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

export default function Communities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: "", description: "", category: "" });
  const [posts, setPosts] = useState([]);
  const [commentTextById, setCommentTextById] = useState({});

  const [communityRequests, setCommunityRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, user, refreshUser } = useAuth();
  const API = getApiUrl();
  const { toast } = useToast();
  const [joiningIds, setJoiningIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/api/communities`);
        const json = await res.json().catch(()=>({}));
        if (!mounted) return;
        setCommunities(json.communities || []);
      } catch (err) {
        console.error(err);
        toast({ title: "Failed to load", description: "Unable to load communities" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // admin requests loading (only for privileged users)
    if (token && user && (user.role === "Admin" || user.role === "SuperAdmin")) {
      (async () => {
        try {

          const r2 = await fetch(`${API}/api/admin/community-requests`, { headers: { Authorization: `Bearer ${token}` } });
          if (r2.ok) {
            const j2 = await r2.json().catch(()=>({}));
            setCommunityRequests(j2.requests || []);
          }
        } catch (err) {
          console.error('[communities] admin fetch failed', err);
        }
      })();
    }

    return () => { mounted = false; };
  }, [API, token, toast, user]);

  useEffect(() => {
    if (user && user.communities) setJoinedCommunities((user.communities || []).map((c) => String(c._id || c)));
  }, [user]);

  const filteredCommunities = communities.filter((c) => {
    const q = (searchTerm || "").toLowerCase();
    const matchesSearch = (c.name || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q);
    return matchesSearch;
  });

  const displayedCommunities = filteredCommunities.filter((c) => {
    if (viewMode === "joined") return (joinedCommunities || []).includes(String(c._id || c.id));
    return true;
  });

  const handleJoinCommunity = async (communityId, leave = false) => {
    if (!token) { toast({ title: "Login required", description: "Please log in to join or leave communities" }); return; }
    const idStr = String(communityId);
    if ((joiningIds || []).includes(idStr)) return;
    setJoiningIds(prev => Array.from(new Set([...(prev || []), idStr])));
    try {
      const isJoined = (joinedCommunities || []).includes(idStr);
      if (isJoined && leave) {
        const res = await fetch(`${API}/api/communities/${communityId}/leave`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' } });
        const json = await res.json().catch(()=>({}));
        if (res.ok) {
          toast({ title: 'Left', description: `You left ${json.community?.name || 'the community'}` });
          setJoinedCommunities(prev => (prev || []).filter(x => String(x) !== idStr));
          setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === idStr ? json.community : c)));
          try { if (refreshUser) await refreshUser(); } catch (e) { console.warn('refreshUser failed', e); }
        } else {
          toast({ title: 'Action failed', description: json.message || 'Unable to leave community' });
        }
        return;
      }

      if (!isJoined && !leave) {
        const res = await fetch(`${API}/api/communities/${communityId}/join`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' } });
        const json = await res.json().catch(()=>({}));
        if (res.ok) {
          toast({ title: 'Joined', description: 'You have joined the community' });
          setJoinedCommunities(prev => Array.from(new Set([...(prev || []), idStr])));
          setCommunities(prev => (prev || []).map(c => (String(c._id || c.id) === idStr ? json.community : c)));
          try { if (refreshUser) await refreshUser(); } catch (e) { console.warn('refreshUser failed', e); }
        } else {
          toast({ title: 'Action failed', description: json.message || 'Unable to join community' });
        }
        return;
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Action failed', description: 'Unable to update community membership' });
    } finally {
      setJoiningIds(prev => (prev || []).filter(x => String(x) !== idStr));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-6">
        {/* Hero / search */}
        <div className="rounded-lg overflow-hidden shadow-lg bg-gradient-to-r from-primary to-accent p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">Explore Health Communities</h1>
              <p className="opacity-90 mt-1">Join specialized groups, ask questions, and support others.</p>
            </div>
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                <Input className="pl-10 text-black" placeholder="Search communities..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className={`px-3 py-1 rounded ${viewMode === 'all' ? 'bg-white text-primary shadow' : 'bg-gray-100'}`} onClick={() => setViewMode('all')}>All</button>
            <button className={`px-3 py-1 rounded ${viewMode === 'joined' ? 'bg-white text-primary shadow' : 'bg-gray-100'}`} onClick={() => setViewMode('joined')}>Joined</button>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setRequestModalOpen(true)} variant="ghost"><Plus className="h-4 w-4 mr-2" />Request Community</Button>
            {(user?.role === 'Admin' || user?.role === 'SuperAdmin') && (<Button onClick={() => navigate('/admin?tab=communities')}>Manage</Button>)}
          </div>
        </div>

        {/* Communities grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg animate-pulse bg-white" />
            ))
          ) : displayedCommunities.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No communities found</h3>
              <p className="text-muted-foreground">Try adjusting your search or request a new community.</p>
            </div>
          ) : displayedCommunities.map((community) => {
            const cid = community._id || community.id;
            const isJoined = (joinedCommunities || []).includes(String(cid));
            const inFlight = (joiningIds || []).includes(String(cid));
            const coverColor = community.color || 'bg-gradient-to-r from-white to-gray-100';
            return (
              <Card
                key={cid}
                onClick={() => navigate(`/communities/${cid}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/communities/${cid}`); }}
                role="button"
                tabIndex={0}
                className="overflow-hidden transform hover:scale-[1.01] transition cursor-pointer"
              >
                <div className={`h-28 ${coverColor} bg-cover bg-center community-cover`} style={{ backgroundImage: community.coverUrl ? `url(${community.coverUrl})` : undefined }} />
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback>{(community.name || "").split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{community.name}</div>
                          <div className="text-sm text-muted-foreground truncate mt-1">{community.description ?? community.category ?? "No description"}</div>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <div className="text-sm text-muted-foreground">{community.members ?? 0} members</div>
                          {(community.dailyPosts ?? 0) > 0 && (
                            <Badge variant="secondary" className="mt-2">{community.dailyPosts} new</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" /> <span>{community.members ?? 0}</span>
                        </div>

                        <div>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleJoinCommunity(cid, isJoined); }} disabled={inFlight}>
                            {inFlight ? '...' : (isJoined ? 'Leave' : <><UserPlus className="h-4 w-4 mr-2" />Join</>)}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin-only panels (unchanged) */}
        {(user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
          <div className="mt-6 space-y-6">


            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Community Requests</CardTitle>
                <CardDescription>Requests to create communities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {communityRequests.map(r => (
                    <div key={r._id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">Requested by {r.userId?.name} • {r.category}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={async ()=>{ const res = await fetch(`${API}/api/admin/community-requests/${r._id}/approve`, { method:'POST', headers: { Authorization:`Bearer ${token}` } }); if (res.ok) { toast({ title:'Approved' }); setCommunityRequests(prev=>prev.filter(x=>x._id!==r._id)); }}}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={async ()=>{ const reason = window.prompt('Reason'); const res = await fetch(`${API}/api/admin/community-requests/${r._id}/reject`, { method:'POST', headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ reason }) }); if (res.ok) { toast({ title:'Rejected' }); setCommunityRequests(prev=>prev.filter(x=>x._id!==r._id)); }}}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Request modal (keeps existing logic) */}
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
              <h3 className="text-lg font-medium mb-2">Request a Community</h3>
              <div className="space-y-2">
                <Input placeholder="Community name" value={requestForm.name} onChange={(e)=>setRequestForm(prev=>({...prev,name:e.target.value}))} />
                <Input placeholder="Category" value={requestForm.category} onChange={(e)=>setRequestForm(prev=>({...prev,category:e.target.value}))} />
                <textarea className="w-full border rounded p-2" rows={4} placeholder="Description" value={requestForm.description} onChange={(e)=>setRequestForm(prev=>({...prev,description:e.target.value}))} />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={()=>setRequestModalOpen(false)}>Cancel</Button>
                <Button onClick={async ()=>{
                  try {
                    const url = `${API}/api/communities/request`;
                    const res = await fetch(url, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify(requestForm) });
                    const json = await res.json();
                    if (res.ok) { toast({ title: 'Requested', description: 'Community request sent to admins' }); setRequestModalOpen(false); setRequestForm({ name: '', description: '', category: '' }); }
                    else toast({ title: 'Request failed', description: json.message || 'Unable to request' });
                  } catch (err) { console.error(err); toast({ title: 'Request failed', description: 'Unable to request community' }); }
                }}>Send Request</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
