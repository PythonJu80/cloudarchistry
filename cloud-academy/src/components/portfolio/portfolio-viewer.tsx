"use client";

import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  X,
  FileText,
  Building2,
  Clock,
  Trophy,
  Sparkles,
} from "lucide-react";

const DiagramMessage = dynamic(
  () => import("@/components/chat/diagram-message").then((mod) => mod.DiagramMessage),
  { ssr: false, loading: () => <div className="h-[450px] bg-slate-800 rounded-xl animate-pulse" /> }
);

interface DiagramNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    serviceId: string;
    label: string;
    sublabel?: string;
    color: string;
    subnetType?: "public" | "private";
  };
  parentId?: string;
  width?: number;
  height?: number;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

interface PortfolioData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  isExample: boolean;
  companyName: string | null;
  industry: string | null;
  locationName: string | null;
  awsServices: string[];
  challengeScore: number;
  maxScore: number;
  completionTimeMinutes: number;
  thumbnailUrl: string | null;
  pdfUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
  businessUseCase?: string | null;
  problemStatement?: string | null;
  solutionSummary?: string | null;
  keyDecisions?: string[];
  complianceAchieved?: string[];
  architectureDiagram?: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
  } | null;
}

interface PortfolioViewerProps {
  portfolio: PortfolioData | null;
  open: boolean;
  onClose: () => void;
}

export function PortfolioViewer({ portfolio, open, onClose }: PortfolioViewerProps) {
  if (!portfolio) return null;

  const pdfUrl = `/api/portfolio/${portfolio.id}/pdf`;

  const handleDownload = () => {
    window.open(pdfUrl, "_blank");
  };

  const hasDiagram = portfolio.architectureDiagram && 
    portfolio.architectureDiagram.nodes && 
    portfolio.architectureDiagram.nodes.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 bg-slate-950 border-border/50 [&>button]:hidden">
        <DialogHeader className="px-6 py-4 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                  {portfolio.title}
                  {portfolio.isExample && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Example
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {portfolio.companyName && (
                    <>
                      <Building2 className="w-3 h-3" />
                      {portfolio.companyName}
                    </>
                  )}
                  {portfolio.industry && (
                    <span className="text-muted-foreground/60">• {portfolio.industry}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-6 p-4 bg-slate-900/50 rounded-lg border border-border/30">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span className="text-xl font-bold text-amber-400">{portfolio.challengeScore}</span>
                  <span className="text-muted-foreground">/ {portfolio.maxScore} points</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="text-xl font-bold">{portfolio.completionTimeMinutes}</span>
                  <span className="text-muted-foreground">minutes</span>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400/30 ml-auto">
                  {portfolio.status}
                </Badge>
              </div>

              {portfolio.businessUseCase && (
                <section>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Business Context
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">{portfolio.businessUseCase}</p>
                </section>
              )}

              {portfolio.problemStatement && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">The Challenge</h2>
                  <p className="text-muted-foreground leading-relaxed">{portfolio.problemStatement}</p>
                </section>
              )}

              {portfolio.solutionSummary && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Solution Architecture</h2>
                  <p className="text-muted-foreground leading-relaxed">{portfolio.solutionSummary}</p>
                </section>
              )}

              {hasDiagram && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Architecture Diagram</h2>
                  <DiagramMessage
                    diagram={{
                      nodes: portfolio.architectureDiagram!.nodes.map(node => {
                        const isContainer = node.type === "vpc" || node.type === "subnet";
                        return {
                          id: node.id,
                          type: isContainer ? "group" : "awsService",
                          position: node.position,
                          data: {
                            label: node.data.label,
                            service_id: node.data.serviceId,
                            description: node.data.sublabel,
                            // Pass width/height for container nodes
                            width: isContainer ? node.width : undefined,
                            height: isContainer ? node.height : undefined,
                          },
                        };
                      }),
                      edges: portfolio.architectureDiagram!.edges,
                      metadata: {
                        nodes_count: portfolio.architectureDiagram!.nodes.length,
                      },
                    }}
                  />
                </section>
              )}

              {portfolio.awsServices && portfolio.awsServices.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">AWS Services Used</h2>
                  <div className="flex flex-wrap gap-2">
                    {portfolio.awsServices.map((service, i) => (
                      <Badge key={i} variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {portfolio.keyDecisions && portfolio.keyDecisions.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Key Architectural Decisions</h2>
                  <ul className="space-y-2">
                    {portfolio.keyDecisions.map((decision, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-purple-400 mt-0.5">•</span>
                        {decision}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {portfolio.complianceAchieved && portfolio.complianceAchieved.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Compliance Standards</h2>
                  <div className="flex flex-wrap gap-2">
                    {portfolio.complianceAchieved.map((standard, i) => (
                      <Badge key={i} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                        {standard}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="w-72 border-l border-border/50 bg-slate-900/30 overflow-y-auto p-4 space-y-4">
            {portfolio.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                <p className="text-sm">{portfolio.description}</p>
              </div>
            )}

            {portfolio.awsServices && portfolio.awsServices.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  AWS Services ({portfolio.awsServices.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {portfolio.awsServices.slice(0, 8).map((service, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{service}</Badge>
                  ))}
                  {portfolio.awsServices.length > 8 && (
                    <Badge variant="outline" className="text-xs">+{portfolio.awsServices.length - 8} more</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Details</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Created: {new Date(portfolio.createdAt).toLocaleDateString()}</p>
                {portfolio.generatedAt && <p>Generated: {new Date(portfolio.generatedAt).toLocaleDateString()}</p>}
                <p>Type: {portfolio.isExample ? "Example Portfolio" : "Generated"}</p>
                {portfolio.locationName && <p>Location: {portfolio.locationName}</p>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
