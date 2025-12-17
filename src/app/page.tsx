"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Cloud,
  Boxes,
  Workflow,
  Activity,
  Brain,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Services offered by CloudFabric
const services = [
  {
    title: "CloudMigrate",
    description: "Drag-and-drop uploads to S3. Progress tracking. Transfer history. Browse your buckets.",
    icon: Upload,
    href: "/migrate",
    color: "#4ade80",
  },
  {
    title: "CloudFlow",
    description: "Visual workflow builder with 140+ nodes. AWS, GCP, Azure, Oracle. AI-assisted automation.",
    icon: Workflow,
    href: "/cloudflow",
    color: "#f472b6",
  },
  {
    title: "CloudArch",
    description: "Describe what you want. AI draws the architecture. Edit visually. Deploy via CloudFormation.",
    icon: Boxes,
    href: "/architecture",
    color: "#22d3ee",
  },
  {
    title: "CloudWatch",
    description: "Real-time AWS metrics, costs, and alerts. EC2, Lambda, Cost Explorer in one dashboard.",
    icon: Activity,
    href: "/monitoring",
    color: "#fb923c",
  },
  {
    title: "CloudGPT",
    description: "Query your data with natural language. Generate charts, tables, reports. RAG-powered context.",
    icon: Brain,
    href: "/chat",
    color: "#fbbf24",
  },
];

const features = [
  { icon: Zap, title: "Fast & Reliable", description: "Enterprise-grade performance" },
  { icon: Shield, title: "Secure", description: "End-to-end encryption" },
  { icon: Globe, title: "Multi-Cloud", description: "AWS, GCP, Azure, Oracle" },
];

const cloudProviders = [
  { name: "AWS", color: "#FF9900", isGoogle: false },
  { name: "Google Cloud", color: "", isGoogle: true },
  { name: "Azure", color: "#0078D4", isGoogle: false },
  { name: "Oracle", color: "#F80000", isGoogle: false },
];

export default function LandingPage() {
  const { data: session, status } = useSession();

  // Render skeleton for auth buttons while session is loading to prevent flash
  const renderAuthButtons = () => {
    if (status === "loading") {
      return (
        <div className="flex items-center gap-4">
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-28 bg-muted animate-pulse rounded-md" />
        </div>
      );
    }
    
    if (session) {
      return (
        <>
          <span className="text-sm text-muted-foreground hidden md:block">
            {session.user.email}
          </span>
          <Link href="/migrate">
            <Button className="bg-terminal-cyan hover:bg-terminal-cyan/90 text-black">
              Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </>
      );
    }
    
    return (
      <>
        <Link href="/login">
          <Button variant="ghost">Sign In</Button>
        </Link>
        <Link href="/register">
          <Button className="bg-terminal-cyan hover:bg-terminal-cyan/90 text-black">
            Get Started
          </Button>
        </Link>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/branding/cloudfabric-icon.svg"
              alt="CloudFabric"
              width={56}
              height={56}
              className="shrink-0"
            />
            <span className="text-lg font-bold text-terminal-cyan font-mono">CloudFabric</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {renderAuthButtons()}
          </div>
        </div>
      </header>

      {/* Hero + Services Combined */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Text */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Multi-Cloud Management Platform
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Upload to S3. Build workflows visually. Design architecture with AI. Monitor AWS metrics. All in one place.
            </p>
            
            {/* Cloud Provider Pills */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {cloudProviders.map((provider) => (
                <span 
                  key={provider.name}
                  className="px-3 py-1 text-xs font-medium rounded-full border border-border bg-card"
                  style={{ color: provider.isGoogle ? undefined : provider.color }}
                >
                  {provider.isGoogle ? (
                    <>
                      <span style={{ color: "#4285F4" }}>G</span>
                      <span style={{ color: "#EA4335" }}>o</span>
                      <span style={{ color: "#FBBC05" }}>o</span>
                      <span style={{ color: "#4285F4" }}>g</span>
                      <span style={{ color: "#34A853" }}>l</span>
                      <span style={{ color: "#EA4335" }}>e</span>
                      <span style={{ color: "#9CA3AF" }}> Cloud</span>
                    </>
                  ) : (
                    provider.name
                  )}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <Link href={session ? "/migrate" : "/register"}>
                <Button size="lg" className="bg-terminal-cyan hover:bg-terminal-cyan/90 text-black">
                  {session ? "Open Dashboard" : "Start Free"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.title}
                  href={session ? service.href : "/login"}
                  className="group p-5 bg-card border border-border rounded-xl hover:border-terminal-cyan/50 transition-all text-center"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${service.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: service.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2 group-hover:text-terminal-cyan transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Features Bar */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 py-6 border-y border-border/50">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-terminal-cyan" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why CloudFabric */}
      <section className="py-16 px-6 bg-card/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-4">What's Under the Hood</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
            Built on PostgreSQL, Neo4j, Redis, and OpenAI. Multi-tenant. AES-256 encrypted credentials.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-foreground mb-2">Neo4j Graph</h3>
              <p className="text-xs text-muted-foreground">Resources stored as nodes with relationships. Run PageRank, path finding, community detection.</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-foreground mb-2">RAG Context</h3>
              <p className="text-xs text-muted-foreground">Scrape your company website. Embed and store. CloudGPT includes your context in every response.</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-foreground mb-2">CloudFormation Deploy</h3>
              <p className="text-xs text-muted-foreground">Design diagrams with 50+ AWS services. Generate templates. Deploy stacks directly from the canvas.</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <h3 className="font-semibold text-foreground mb-2">Multi-Cloud Nodes</h3>
              <p className="text-xs text-muted-foreground">140+ workflow nodes across AWS, GCP, Azure, Oracle. Triggers, logic, AI, local files.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Built for the next generation of cloud engineers
          </h2>
          <p className="text-muted-foreground mb-6">
            Solutions Architects. DevOps. Data Engineers. Migration Specialists. This is your new standard tool.
          </p>
          <Link href={session ? "/migrate" : "/register"}>
            <Button size="lg" className="bg-terminal-cyan hover:bg-terminal-cyan/90 text-black">
              {session ? "Go to Dashboard" : "Get Started Free"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-terminal-cyan" />
            <span className="text-sm text-muted-foreground">
              © 2025 CloudFabric. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <a href="http://localhost:6081" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
