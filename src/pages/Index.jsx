import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Heart, Users, MessageSquare, Shield, CheckCircle, ArrowRight, Stethoscope, UserCheck, Brain } from "lucide-react";
import heroImage from "@/assets/healthcare-hero.jpg";
import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: "Health Communities", description: "Join specialized health communities and connect with others facing similar health challenges.", color: "text-primary" },
    { icon: Brain, title: "AI-Powered Support", description: "Get instant, intelligent responses to your health questions from our advanced AI system.", color: "text-accent" },
    { icon: Stethoscope, title: "Medical Validation", description: "All AI responses are reviewed and validated by certified medical professionals.", color: "text-success" },
    { icon: Shield, title: "Safe & Secure", description: "Your health information is protected with enterprise-grade security and privacy.", color: "text-warning" }
  ];

  const [stats, setStats] = useState([
    { number: "--", label: "Posts", icon: Users },
    { number: "--", label: "Health Communities", icon: MessageSquare },
    { number: "--", label: "Verified Doctors", icon: UserCheck },
  ]);

  useEffect(() => {
    let mounted = true;
    const API = getApiUrl();

    async function load() {
      try {
        // communities count
        const r1 = await fetch(`${API}/api/communities`);
        const j1 = await r1.json();
        const communities = Array.isArray(j1) ? j1 : (j1.communities || []);

        // posts count
        const r2 = await fetch(`${API}/api/posts`);
        const j2 = await r2.json();
        const posts = Array.isArray(j2) ? j2 : (j2.posts || []);

        // verified doctors count (from new endpoint)
        let verifiedDoctors = "--";
        try {
          const r3 = await fetch(`${API}/api/admin/doctor-count`);
          if (r3.ok) {
            const j3 = await r3.json();
            // prefer { count }
            if (j3 && typeof j3.count === 'number') verifiedDoctors = j3.count;
            else if (typeof j3 === 'number') verifiedDoctors = j3;
            else if (Array.isArray(j3)) verifiedDoctors = j3.length;
            else verifiedDoctors = j3?.total ?? "--";
          }
        } catch (_) { /* leave as -- */ }

        if (!mounted) return;
        setStats([
          { number: `${(posts || []).length}`, label: "Posts", icon: Users },
          { number: `${(communities || []).length}`, label: "Health Communities", icon: MessageSquare },
          { number: `${verifiedDoctors}`, label: "Verified Doctors", icon: UserCheck },
        ]);
      } catch (err) {
        console.error('Failed to load index stats', err);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">CareCircle</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate("/login")}>Sign In</Button>
            <Button onClick={() => navigate("/register")}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="container grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit">Trusted Healthcare Community</Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">Your Health <span className="gradient-healthcare bg-clip-text text-transparent">Community</span> Awaits</h1>
              <p className="text-xl text-muted-foreground max-w-xl">Connect with others, ask questions, and get AI-powered health insights validated by medical professionals. Your journey to better health starts here.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={() => navigate("/register")} className="shadow-healthcare">Join Community<ArrowRight className="ml-2 h-5 w-5" /></Button>
            </div>
            <div className="flex items-center space-x-6 pt-4">
              <div className="flex items-center space-x-2"><CheckCircle className="h-5 w-5 text-success" /><span className="text-sm text-muted-foreground">Free to join</span></div>
              <div className="flex items-center space-x-2"><CheckCircle className="h-5 w-5 text-success" /><span className="text-sm text-muted-foreground">Doctor verified</span></div>
              <div className="flex items-center space-x-2"><CheckCircle className="h-5 w-5 text-success" /><span className="text-sm text-muted-foreground">Privacy focused</span></div>
            </div>
          </div>

          <div className="relative">
            <img src={heroImage} alt="Healthcare community connecting people" className="rounded-2xl shadow-healthcare w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-2">
                <div className="flex justify-center"><stat.icon className="h-8 w-8 text-primary" /></div>
                <div className="text-3xl font-bold text-primary">{stat.number}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
            </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Everything you need for <span className="text-primary">better health</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Our platform combines the power of community support with AI intelligence and professional medical validation.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="shadow-card hover:shadow-healthcare transition-shadow">
                <CardHeader>
                  <feature.icon className={`h-10 w-10 ${feature.color}`} />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-accent text-white">
        <div className="container text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Ready to join our healthcare community?</h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">Connect with others, share experiences, and get the support you need on your health journey.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={() => navigate("/register")} className="bg-white text-primary hover:bg-white/90">Create Account<ArrowRight className="ml-2 h-5 w-5" /></Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="border-white text-black hover:bg-white/10">Sign In</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-muted/30">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2"><Heart className="h-5 w-5 text-primary" /><span className="font-semibold text-primary">CareCircle</span></div>
            <p className="text-sm text-muted-foreground">© 2025 CareCircle. Building healthier communities together.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
