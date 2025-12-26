import { NextResponse } from "next/server";
import { AWS_SERVICES } from "@/lib/aws-services";

/**
 * GET /api/services/list - Return all AWS services
 * Used by Learning Agent to get the authoritative service list
 */
export async function GET() {
  // Build service list grouped by category
  const byCategory: Record<string, string[]> = {};
  
  for (const service of AWS_SERVICES) {
    if (!byCategory[service.category]) {
      byCategory[service.category] = [];
    }
    byCategory[service.category].push(service.id);
  }

  return NextResponse.json({
    services: AWS_SERVICES.map(s => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      category: s.category,
      isContainer: s.isContainer || false,
      mustBeInside: s.mustBeInside || [],
      canConnectTo: s.canConnectTo || [],
    })),
    byCategory,
  });
}
