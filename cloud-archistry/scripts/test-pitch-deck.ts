import { renderToFile } from "@react-pdf/renderer";
import { PortfolioPDF, PortfolioPDFData } from "../src/lib/portfolio/pdf-template";

const testData: PortfolioPDFData = {
  title: "Cloud Migration for Acme Coffee Shop",
  companyName: "Acme Coffee Shop",
  industry: "Food & Beverage",
  businessUseCase: "Acme Coffee Shop is expanding from 5 to 25 locations and needs modern POS, inventory, and customer loyalty systems that can scale with their growth.",
  problemStatement: "Current on-premise infrastructure cannot handle multi-location synchronization, leading to inventory discrepancies and inconsistent customer experiences.",
  solutionSummary: "Designed a scalable AWS architecture using EC2, RDS, S3, CloudFront, Lambda, and API Gateway to support rapid expansion with real-time data synchronization across all locations.",
  awsServices: ["EC2", "RDS", "S3", "CloudFront", "Lambda", "API Gateway"],
  keyDecisions: [
    "Multi-AZ deployment for 99.99% uptime",
    "Serverless loyalty program using Lambda for instant scaling",
    "CloudFront CDN for sub-100ms menu loading",
    "Real-time inventory sync with DynamoDB Streams",
  ],
  complianceAchieved: ["PCI-DSS", "SOC 2"],
  technicalHighlights: [
    "Auto-scaling configuration for peak hours (10x traffic spikes)",
    "Real-time inventory sync across 25 locations",
    "Mobile app backend with API Gateway and Lambda",
    "Cost optimization achieving 35% reduction vs on-premise",
  ],
  createdAt: new Date().toISOString(),
  architectureDiagram: null,
  // Pitch deck data for business presentation
  pitchDeck: {
    authorName: "John Smith",
    date: "January 2026",
    slides: [
      {
        badge: "AWS ARCHITECTURE PROPOSAL",
        title: "Cloud Migration Proposal for Acme Coffee Shop",
        subtitle: "Modernizing Food & Beverage Infrastructure with AWS",
        content1: "Acme Coffee Shop",
        content2: "Prepared by John Smith",
        content3: "",
        footer: "January 2026",
      },
      {
        badge: "THE CHALLENGE",
        title: "Current Infrastructure Limitations",
        subtitle: "",
        content1: "• Outdated POS systems causing 15% slower transaction times during peak hours",
        content2: "• Manual inventory management leading to 20% stockouts and $50K annual waste",
        content3: "• No integrated loyalty program - losing 30% of potential repeat customers",
        footer: "These challenges cost Acme Coffee Shop over $200K annually in lost revenue",
      },
      {
        badge: "THE SOLUTION",
        title: "AWS-Powered Architecture",
        subtitle: "A scalable, secure cloud platform designed for rapid expansion from 5 to 25 locations with real-time data synchronization.",
        content1: "AWS Services: EC2, RDS, S3, CloudFront, Lambda, API Gateway",
        content2: "Multi-AZ deployment for 99.99% uptime | Serverless loyalty program",
        content3: "CDN for sub-100ms menu loading | Real-time inventory sync",
        footer: "",
      },
      {
        badge: "IMPLEMENTATION",
        title: "3-Phase Roadmap",
        subtitle: "VPC setup, security baseline, IAM (2-3 weeks)",
        content1: "Database migration, app deployment, testing (4-6 weeks)",
        content2: "Performance tuning, cost optimization, monitoring (ongoing)",
        content3: "Immediate POS speed improvement | Real-time inventory visibility",
        footer: "Total Timeline: 8-12 Weeks",
      },
      {
        badge: "INVESTMENT & NEXT STEPS",
        title: "Projected Costs & ROI",
        subtitle: "Monthly: $3,500 | Yearly: $42,000",
        content1: "Projected ROI: 35% cost reduction in Year 1",
        content2: "Next Steps: 1. Discovery call 2. Finalize scope 3. Begin Phase 1",
        content3: "",
        footer: "Let's transform Acme Coffee Shop's infrastructure together",
      },
    ],
  },
};

async function main() {
  console.log("🎨 Generating combined Portfolio + Pitch Deck PDF...");
  await renderToFile(PortfolioPDF({ data: testData }), "/tmp/combined-portfolio-pitchdeck.pdf");
  console.log("✅ PDF saved to /tmp/combined-portfolio-pitchdeck.pdf");
}

main().catch(console.error);
