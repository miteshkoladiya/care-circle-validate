import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Layout/Navbar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function CreateCommunity() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const { token } = useAuth();
  const API = getApiUrl();
  const { toast } = useToast();
  const navigate = useNavigate();

  const create = async () => {
    try {
      const res = await fetch(`${API}/api/communities`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, description })
      });
      const json = await res.json();
      if (res.ok) {
        toast({ title: "Community created", description: json.community?.name || name });
        navigate('/admin?tab=communities');
      } else {
        toast({ title: "Create failed", description: json.message || "Unable to create community" });
      }
    } catch (err) {
      toast({ title: "Create failed", description: err?.message || String(err) });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Create Community</h1>
        <div className="max-w-xl">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="mb-2" />
          <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="mb-2" />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="mb-2" />
          <div className="flex space-x-2">
            <Button onClick={create}>Create</Button>
            <Button variant="ghost" onClick={() => navigate('/admin?tab=communities')}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
