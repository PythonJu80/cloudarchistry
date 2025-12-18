"use client";

/**
 * ArcHub Diagram Viewer
 * 
 * Read-only React Flow canvas for viewing uploaded AWS architecture diagrams.
 * Uses the same node types as the challenge diagram builder.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/diagram/aws-nodes";
import { parseDrawioXml, type ParsedDiagram } from "@/lib/drawio-parser";
import { Loader2, AlertCircle } from "lucide-react";

interface DiagramViewerProps {
  diagramUrl?: string;
  diagramContent?: string;
  format?: "drawio_xml" | "vsdx";
  className?: string;
  showControls?: boolean;
  showMiniMap?: boolean;
}

function DiagramViewerInner({
  diagramUrl,
  diagramContent,
  format = "drawio_xml",
  className = "",
  showControls = true,
  showMiniMap = false,
}: DiagramViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDiagram | null>(null);

  // Fetch and parse diagram
  useEffect(() => {
    async function loadDiagram() {
      setLoading(true);
      setError(null);

      try {
        let content = diagramContent;

        // Fetch from URL if not provided directly
        if (!content && diagramUrl) {
          const response = await fetch(diagramUrl);
          if (!response.ok) {
            throw new Error("Failed to fetch diagram");
          }
          content = await response.text();
        }

        if (!content) {
          throw new Error("No diagram content provided");
        }

        // Parse based on format
        if (format === "drawio_xml") {
          const parsed = parseDrawioXml(content);
          setParsedData(parsed);
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
        } else {
          throw new Error("VSDX format not yet supported");
        }
      } catch (err) {
        console.error("Error loading diagram:", err);
        setError(err instanceof Error ? err.message : "Failed to load diagram");
      } finally {
        setLoading(false);
      }
    }

    loadDiagram();
  }, [diagramUrl, diagramContent, format, setNodes, setEdges]);

  // Fit view on load
  const onInit = useCallback((reactFlowInstance: { fitView: () => void }) => {
    setTimeout(() => {
      reactFlowInstance.fitView();
    }, 100);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/50 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/50 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/50 rounded-lg ${className}`} style={{ minHeight: 400 }}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-amber-400 text-sm">No AWS services detected in diagram</p>
          <p className="text-slate-500 text-xs mt-1">The diagram may use unsupported shapes</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${className}`} style={{ minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#334155"
        />
        {showControls && (
          <Controls
            showZoom
            showFitView
            showInteractive={false}
            className="!bg-slate-800 !border-slate-700"
          />
        )}
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => (node.data?.color as string) || "#6B7280"}
            maskColor="rgba(0, 0, 0, 0.8)"
            className="!bg-slate-800 !border-slate-700"
          />
        )}
      </ReactFlow>

      {/* Service count badge */}
      {parsedData && (
        <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400">Services:</span>
              <span className="text-white font-medium ml-1">{parsedData.services.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Categories:</span>
              <span className="text-white font-medium ml-1">{parsedData.categories.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DiagramViewer(props: DiagramViewerProps) {
  return (
    <ReactFlowProvider>
      <DiagramViewerInner {...props} />
    </ReactFlowProvider>
  );
}

export default DiagramViewer;
