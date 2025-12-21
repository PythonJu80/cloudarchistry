"use client";

import Link from "next/link";
import { 
  Check,
  X,
  Zap,
  Building2,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";

const plans = [
  {
    name: "Free Trial",
    price: "£0",
    period: "14 days",
    description: "Try everything free for 14 days",
    features: [
      "Full platform access",
      "All challenges unlocked",
      "AI coaching & feedback",
      "Progress tracking",
      "No credit card required",
    ],
    notIncluded: [],
    cta: "Start Free Trial",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Learner",
    price: "£29",
    period: "per month",
    description: "For individual learners ready to master AWS",
    features: [
      "Unlimited challenges",
      "AI coaching & feedback",
      "Flashcards & quizzes",
      "Progress tracking",
      "All certification paths",
      "Join cohorts when invited",
      "Priority support",
    ],
    notIncluded: [
      "Create cohorts",
      "Manage learners",
    ],
    cta: "Start Learning",
    variant: "glow" as const,
    popular: true,
  },
  {
    name: "Tutor",
    price: "£79",
    period: "per month",
    description: "For tutors who want to train teams",
    features: [
      "Everything in Learner",
      "Create & manage cohorts",
      "Invite learners",
      "Cohort progress dashboard",
      "Team analytics",
      "Custom scenario creation",
      "Export progress reports",
    ],
    notIncluded: [],
    cta: "Become a Tutor",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Bootcamp",
    price: "Custom",
    period: "enterprise",
    description: "For training providers & enterprises",
    features: [
      "Everything in Tutor",
      "Unlimited cohorts",
      "White-label options",
      "SSO & SAML",
      "Custom challenges",
      "Dedicated success manager",
      "SLA & priority support",
    ],
    notIncluded: [],
    cta: "Contact Us",
    variant: "outline" as const,
    popular: false,
  },
];

const faqs = [
  {
    question: "How does the 14-day free trial work?",
    answer: "Sign up and get full access to all features for 14 days. No credit card required. At the end of your trial, choose Learner or Tutor to continue.",
  },
  {
    question: "What's the difference between Learner and Tutor?",
    answer: "Learners can complete challenges and join cohorts when invited. Tutors can do everything Learners can, plus create cohorts, invite learners, and track team progress.",
  },
  {
    question: "Can I switch plans anytime?",
    answer: "Yes, you can upgrade from Learner to Tutor at any time. Changes take effect immediately.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards. For Bootcamp/Enterprise plans, we also accept invoicing and wire transfers.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar activePath="/pricing" variant="transparent" />

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
