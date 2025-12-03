import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Heart, Users, MessageSquare, Shield, CheckCircle, ArrowRight, Stethoscope, UserCheck, Brain, Sparkles, Activity } from "lucide-react";
import heroImage from "@/assets/healthcare-hero.jpg";
import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { Footer } from "@/components/Layout/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PublicNavbar } from "@/components/Layout/PublicNavbar";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Users, title: "Health Communities", description: "Join specialized health communities and connect with others facing similar health challenges.", color: "text-primary" },
    { icon: Brain, title: "AI-Powered Support", description: "Get instant, intelligent responses to your health questions from our advanced AI system.", color: "text-indigo-500" },
    { icon: Stethoscope, title: "Medical Validation", description: "All AI responses are reviewed and validated by certified medical professionals.", color: "text-green-500" },
    { icon: Shield, title: "Safe & Secure", description: "Your health information is protected with enterprise-grade security and privacy.", color: "text-amber-500" }
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

        // verified doctors count
        let verifiedDoctors = "--";
        try {
          const r3 = await fetch(`${API}/api/admin/doctor-count`);
          if (r3.ok) {
            const j3 = await r3.json();
            if (j3 && typeof j3.count === 'number') verifiedDoctors = j3.count;
            else if (typeof j3 === 'number') verifiedDoctors = j3;
            else if (Array.isArray(j3)) verifiedDoctors = j3.length;
            else verifiedDoctors = j3?.total ?? "--";
          }
        } catch (_) { /* leave as -- */ }

        if (!mounted) return;
        setStats([
          { number: `${(posts || []).length}`, label: "Questions Answered", icon: MessageSquare },
          { number: `${(communities || []).length}`, label: "Active Communities", icon: Users },
          { number: `${verifiedDoctors}`, label: "Verified Specialists", icon: UserCheck },
        ]);
      } catch (err) {
        console.error('Failed to load index stats', err);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background z-0" />
        <div className="absolute top-0 right-0 p-20 opacity-20 transform translate-x-1/3 -translate-y-1/3">
          <div className="w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        
        <div className="container relative z-10 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit px-4 py-1.5 text-sm font-medium border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="w-3.5 h-3.5 mr-2 fill-primary" />
                The Future of Healthcare Support
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Your Health <br />
                <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">Community</span> Awaits
              </h1>
              <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
                Connect with others, ask questions, and get AI-powered health insights validated by real medical professionals.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={() => navigate("/register")} className="text-lg px-8 h-12 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
                Join Community <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="text-lg px-8 h-12">
                Sign In
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Free to join</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Doctor verified</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Privacy focused</div>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-right-4 duration-1000 delay-200">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border/50">
              <img src={heroImage} alt="Healthcare community connecting people" className="w-full object-cover transform hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center space-y-2 pt-4 sm:pt-0">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="text-4xl font-bold text-foreground tracking-tight">{stat.number}</div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything you need for <span className="text-primary">better health</span></h2>
            <p className="text-xl text-muted-foreground">Our platform combines the power of community support with AI intelligence and professional medical validation.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className={`h-12 w-12 rounded-lg bg-background border shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">How CareCircle Works</h2>
            <p className="text-xl text-muted-foreground">Simple steps to get the support you need.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent z-0" />
            
            {[
              { step: "01", title: "Join a Community", desc: "Find your tribe. Connect with people who understand your health journey.", icon: Users },
              { step: "02", title: "Ask & Learn", desc: "Post your questions. Get instant AI answers and community support.", icon: MessageSquare },
              { step: "03", title: "Get Validated", desc: "Rest easy. Real doctors review and validate the medical advice.", icon: CheckCircle }
            ].map((item, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-background border-4 border-muted flex items-center justify-center shadow-lg relative group">
                  <span className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">
                    {item.step}
                  </span>
                  <item.icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-violet-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
        <div className="container relative z-10 text-center space-y-8">
          <div className="space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Ready to take control of your health?</h2>
            <p className="text-xl text-white/90">Join CareCircle today and become part of a supportive, medically-verified community.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" variant="secondary" onClick={() => navigate("/register")} className="bg-white text-primary hover:bg-white/90 text-lg px-8 h-12 shadow-xl">
              Create Account
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")} className="border-white/30 bg-white/10 text-white hover:bg-white/20 text-lg px-8 h-12 backdrop-blur-sm">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
