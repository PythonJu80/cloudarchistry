"use client";

import Link from "next/link";
import { 
  Globe, 
  Check,
  X,
  Zap,
  Building2,
  Users,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavbarAvatar } from "@/components/navbar";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Explore the platform and see what's possible",
    features: [
      "Browse world map",
      "View all challenges",
      "Leaderboard access",
      "Community forums",
    ],
    notIncluded: [
      "Start challenges",
      "AI coaching",
      "Knowledge graph",
    ],
    cta: "Start Free",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Learner",
    price: "$19",
    period: "per month",
    description: "For individual learners ready to master AWS",
    features: [
      "Unlimited challenges",
      "AI coaching & feedback",
      "Flashcards & quizzes",
      "Progress tracking",
      "All certification paths",
      "Priority support",
    ],
    notIncluded: [
      "Knowledge graph",
      "Custom scenarios",
    ],
    cta: "Start Learning",
    variant: "glow" as const,
    popular: true,
  },
  {
    name: "Pro",
    price: "$49",
    period: "per month",
    description: "For architects who want the full experience",
    features: [
      "Everything in Learner",
      "Neo4j knowledge graph",
      "Custom scenario creation",
      "Advanced analytics",
      "API access",
      "Export progress reports",
    ],
    notIncluded: [],
    cta: "Go Pro",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Team",
    price: "$29",
    period: "per user/month",
    description: "Train your cloud team together",
    features: [
      "Everything in Pro",
      "Team dashboard",
      "Shared progress tracking",
      "Admin controls",
      "SSO & SAML",
      "Custom challenges",
      "Dedicated success manager",
    ],
    notIncluded: [],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false,
    minUsers: 5,
  },
];

const faqs = [
  {
    question: "Can I switch plans anytime?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
  },
  {
    question: "Is there a free trial for Pro?",
    answer: "Yes! Pro comes with a 14-day free trial. No credit card required.",
  },
  {
    question: "Do you offer student discounts?",
    answer: "Yes, students get 50% off Pro with a valid .edu email address.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and wire transfers for Enterprise.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <NavbarAvatar />
            <span className="text-xl font-bold">CloudAcademy</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/world" className="text-muted-foreground hover:text-foreground transition-colors">
              World Map
            </Link>
            <Link href="/challenges" className="text-muted-foreground hover:text-foreground transition-colors">
              Challenges
            </Link>
            <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Leaderboard
            </Link>
            <Link href="/pricing" className="text-foreground font-medium">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button variant="glow" size="sm">Start Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Simple, transparent pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Choose your path to{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              cloud mastery
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you&apos;re ready. No hidden fees, cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative bg-card/50 border-border/50 ${
                  plan.popular ? "border-primary shadow-lg shadow-primary/10 md:scale-105 z-10" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm ml-1">/{plan.period}</span>
                  </div>
                  
                  {/* Included features */}
                  <ul className="space-y-2 mb-4 text-left">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {/* Not included */}
                  {plan.notIncluded.length > 0 && (
                    <ul className="space-y-2 mb-4 text-left border-t border-border/50 pt-4">
                      {plan.notIncluded.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  <Link href="/register">
                    <Button 
                      variant={plan.variant} 
                      className="w-full"
                      size="sm"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold">Instant Access</h3>
              <p className="text-sm text-muted-foreground">Start learning immediately after signup</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-blue-400/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-semibold">Enterprise Ready</h3>
              <p className="text-sm text-muted-foreground">SOC 2 compliant, SSO support</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-purple-400/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold">10K+ Architects</h3>
              <p className="text-sm text-muted-foreground">Join a growing community</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <Card key={faq.question} className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/20">
            <CardContent className="py-12">
              <h2 className="text-3xl font-bold mb-4">Ready to become a cloud architect?</h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Join thousands of engineers mastering cloud architecture through real-world challenges.
              </p>
              <Link href="/register">
                <Button variant="glow" size="lg">
                  Start Your Free Trial
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
