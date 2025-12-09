import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

const SERVICES_FILE_PATH = path.join(process.cwd(), "src/lib/aws-services.ts");

// Template for new service
export const SERVICE_TEMPLATE = {
  id: "my-service",
  name: "My Custom Service",
  shortName: "MyService",
  category: "compute", // compute, containers, database, storage, networking, security, analytics, integration, management, devops, governance, policies
  color: "#ED7100",
  description: "Description of what this service does",
  canConnectTo: [], // Optional: array of service IDs this can connect to
  mustBeInside: [], // Optional: array of container IDs this must be inside (e.g., ["vpc", "subnet"])
  isContainer: false, // Optional: true if this is a container like VPC/Subnet
};

// GET - Return the template and current custom services
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      template: SERVICE_TEMPLATE,
      categories: [
        "compute", "containers", "database", "storage", "networking",
        "security", "analytics", "integration", "management", "devops",
        "governance", "policies"
      ],
      categoryColors: {
        compute: "#ED7100",
        containers: "#ED7100",
        database: "#3B48CC",
        storage: "#3F8624",
        networking: "#8C4FFF",
        security: "#DD344C",
        analytics: "#8C4FFF",
        integration: "#E7157B",
        management: "#E7157B",
        devops: "#3F8624",
        governance: "#232F3E",
        policies: "#7C3AED",
      },
    });
  } catch (error) {
    console.error("Error fetching service template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

// POST - Add a new custom service to aws-services.ts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newService = await request.json();

    // Validate required fields
    if (!newService.id || !newService.name || !newService.shortName || !newService.category) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, shortName, category" },
        { status: 400 }
      );
    }

    // Sanitize the ID (lowercase, no spaces)
    newService.id = newService.id.toLowerCase().replace(/\s+/g, "-");

    // Read current file
    const fileContent = await fs.readFile(SERVICES_FILE_PATH, "utf-8");

    // Check if service ID already exists
    if (fileContent.includes(`id: "${newService.id}"`)) {
      return NextResponse.json(
        { error: `Service with ID "${newService.id}" already exists` },
        { status: 400 }
      );
    }

    // Find the closing bracket of AWS_SERVICES array
    const arrayEndIndex = fileContent.lastIndexOf("];");
    if (arrayEndIndex === -1) {
      return NextResponse.json(
        { error: "Could not find AWS_SERVICES array in file" },
        { status: 500 }
      );
    }

    // Build the new service entry - auto-generate description from name
    const description = newService.description || `${newService.name} service`;
    const serviceEntry = `
  // Custom service added via API
  {
    id: "${newService.id}",
    name: "${newService.name}",
    shortName: "${newService.shortName}",
    category: "${newService.category}",
    color: "${newService.color || "#666666"}",
    description: "${description}",${
      newService.canConnectTo?.length
        ? `\n    canConnectTo: ${JSON.stringify(newService.canConnectTo)},`
        : ""
    }${
      newService.mustBeInside?.length
        ? `\n    mustBeInside: ${JSON.stringify(newService.mustBeInside)},`
        : ""
    }${newService.isContainer ? `\n    isContainer: true,` : ""}
  },`;

    // Insert before the closing bracket
    const newContent =
      fileContent.slice(0, arrayEndIndex) +
      serviceEntry +
      "\n" +
      fileContent.slice(arrayEndIndex);

    // Write back to file
    await fs.writeFile(SERVICES_FILE_PATH, newContent, "utf-8");

    return NextResponse.json({
      success: true,
      message: `Service "${newService.name}" added successfully`,
      service: newService,
      note: "Refresh the page to see the new service in the picker",
    });
  } catch (error) {
    console.error("Error adding custom service:", error);
    return NextResponse.json(
      { error: "Failed to add service: " + (error as Error).message },
      { status: 500 }
    );
  }
}
