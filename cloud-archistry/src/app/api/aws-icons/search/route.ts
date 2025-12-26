import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface IconResult {
  id: string;
  name: string;
  category: string;
  iconPath: string;
  type: "service" | "resource" | "category" | "group";
}

// Cache the icon index
let iconIndex: IconResult[] | null = null;

async function buildIconIndex(): Promise<IconResult[]> {
  if (iconIndex) return iconIndex;

  const results: IconResult[] = [];
  const baseDir = path.join(process.cwd(), "public", "aws-icons");

  // Map folder names to categories
  const categoryMap: Record<string, string> = {
    "Arch_Analytics": "Analytics",
    "Arch_App-Integration": "App Integration",
    "Arch_Artificial-Intelligence": "AI/ML",
    "Arch_Blockchain": "Blockchain",
    "Arch_Business-Applications": "Business Apps",
    "Arch_Cloud-Financial-Management": "Cost Management",
    "Arch_Compute": "Compute",
    "Arch_Containers": "Containers",
    "Arch_Customer-Enablement": "Customer Enablement",
    "Arch_Database": "Database",
    "Arch_Developer-Tools": "Developer Tools",
    "Arch_End-User-Computing": "End User Computing",
    "Arch_Front-End-Web-Mobile": "Frontend & Mobile",
    "Arch_Games": "Games",
    "Arch_General-Icons": "General",
    "Arch_Internet-of-Things": "IoT",
    "Arch_Management-Governance": "Management",
    "Arch_Media-Services": "Media",
    "Arch_Migration-Modernization": "Migration",
    "Arch_Networking-Content-Delivery": "Networking",
    "Arch_Quantum-Technologies": "Quantum",
    "Arch_Satellite": "Satellite",
    "Arch_Security-Identity-Compliance": "Security",
    "Arch_Storage": "Storage",
  };

  try {
    // Scan Architecture-Service-Icons (main services)
    const servicesDir = path.join(baseDir, "Architecture-Service-Icons_07312025");
    const serviceFolders = await fs.readdir(servicesDir).catch(() => []);

    for (const folder of serviceFolders) {
      if (folder.startsWith(".")) continue;
      const category = categoryMap[folder] || folder.replace("Arch_", "").replace(/-/g, " ");
      
      // Look in the 48px folder for SVGs
      const size48Dir = path.join(servicesDir, folder, "48");
      try {
        const files = await fs.readdir(size48Dir);
        for (const file of files) {
          if (!file.endsWith(".svg")) continue;
          
          // Parse service name from filename: Arch_AWS-Lambda_48.svg -> AWS Lambda
          const name = file
            .replace("Arch_", "")
            .replace("_48.svg", "")
            .replace(/-/g, " ")
            .replace("Amazon ", "")
            .replace("AWS ", "");
          
          const id = file.replace("_48.svg", "").toLowerCase().replace(/[^a-z0-9]/g, "-");
          
          results.push({
            id,
            name,
            category,
            iconPath: `/aws-icons/Architecture-Service-Icons_07312025/${folder}/48/${file}`,
            type: "service",
          });
        }
      } catch {
        // Folder doesn't exist or can't be read
      }
    }

    // Scan Resource-Icons
    const resourcesDir = path.join(baseDir, "Resource-Icons_07312025");
    const resourceFolders = await fs.readdir(resourcesDir).catch(() => []);

    for (const folder of resourceFolders) {
      if (folder.startsWith(".")) continue;
      const category = folder.replace("Res_", "").replace(/-/g, " ");
      
      try {
        const files = await fs.readdir(path.join(resourcesDir, folder));
        for (const file of files) {
          if (!file.endsWith(".svg") && !file.endsWith("_48.svg")) continue;
          
          // Check if it's a size subfolder
          const subPath = path.join(resourcesDir, folder, file);
          const stat = await fs.stat(subPath);
          
          if (stat.isDirectory() && file === "48") {
            const subFiles = await fs.readdir(subPath);
            for (const subFile of subFiles) {
              if (!subFile.endsWith(".svg")) continue;
              
              const name = subFile
                .replace("Res_", "")
                .replace("_48.svg", "")
                .replace(/-/g, " ");
              
              const id = `res-${subFile.replace("_48.svg", "").toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
              
              results.push({
                id,
                name,
                category,
                iconPath: `/aws-icons/Resource-Icons_07312025/${folder}/48/${subFile}`,
                type: "resource",
              });
            }
          } else if (file.endsWith(".svg")) {
            const name = file
              .replace("Res_", "")
              .replace("_48.svg", "")
              .replace(".svg", "")
              .replace(/-/g, " ");
            
            const id = `res-${file.replace(".svg", "").toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
            
            results.push({
              id,
              name,
              category,
              iconPath: `/aws-icons/Resource-Icons_07312025/${folder}/${file}`,
              type: "resource",
            });
          }
        }
      } catch {
        // Folder doesn't exist
      }
    }

    // Scan Category-Icons
    const categoriesDir = path.join(baseDir, "Category-Icons_07312025", "Arch-Category_48");
    try {
      const files = await fs.readdir(categoriesDir);
      for (const file of files) {
        if (!file.endsWith(".svg")) continue;
        
        const name = file
          .replace("Arch-Category_", "")
          .replace("_48.svg", "")
          .replace(/-/g, " ");
        
        const id = `cat-${file.replace("_48.svg", "").toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        
        results.push({
          id,
          name,
          category: "Category Icons",
          iconPath: `/aws-icons/Category-Icons_07312025/Arch-Category_48/${file}`,
          type: "category",
        });
      }
    } catch {
      // Folder doesn't exist
    }

    // Scan Group Icons
    const groupsDir = path.join(baseDir, "Architecture-Group-Icons_07312025");
    try {
      const files = await fs.readdir(groupsDir);
      for (const file of files) {
        if (!file.endsWith(".svg")) continue;
        
        const name = file
          .replace("_32.svg", "")
          .replace(/-/g, " ");
        
        const id = `group-${file.replace(".svg", "").toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        
        results.push({
          id,
          name,
          category: "Groups",
          iconPath: `/aws-icons/Architecture-Group-Icons_07312025/${file}`,
          type: "group",
        });
      }
    } catch {
      // Folder doesn't exist
    }

    iconIndex = results;
    return results;
  } catch (error) {
    console.error("Error building icon index:", error);
    return [];
  }
}

/**
 * GET /api/aws-icons/search?q=lambda&category=compute&limit=20
 * 
 * Search AWS icons by name or category
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    const category = searchParams.get("category")?.toLowerCase();
    const type = searchParams.get("type") as "service" | "resource" | "category" | "group" | null;
    const limit = parseInt(searchParams.get("limit") || "50");

    const allIcons = await buildIconIndex();

    let results = allIcons;

    // Filter by search query
    if (query) {
      results = results.filter(
        (icon) =>
          icon.name.toLowerCase().includes(query) ||
          icon.category.toLowerCase().includes(query) ||
          icon.id.includes(query)
      );
    }

    // Filter by category
    if (category) {
      results = results.filter((icon) =>
        icon.category.toLowerCase().includes(category)
      );
    }

    // Filter by type
    if (type) {
      results = results.filter((icon) => icon.type === type);
    }

    // Sort by relevance (exact matches first)
    if (query) {
      results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === query ? 0 : 1;
        const bExact = b.name.toLowerCase() === query ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        
        const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts;
      });
    }

    // Limit results
    results = results.slice(0, limit);

    return NextResponse.json({
      success: true,
      query,
      count: results.length,
      total: allIcons.length,
      icons: results,
    });
  } catch (error) {
    console.error("Icon search error:", error);
    return NextResponse.json(
      { error: "Failed to search icons" },
      { status: 500 }
    );
  }
}
