"use client";

import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FloatingHelpButton() {
  return (
    <Link href="/guide" className="fixed bottom-6 right-6 z-50">
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg bg-cyan-500 hover:bg-cyan-600 text-white border-2 border-cyan-400/50 hover:scale-110 transition-all duration-200"
        title="Help & Guide"
      >
        <HelpCircle className="w-6 h-6" />
      </Button>
    </Link>
  );
}
