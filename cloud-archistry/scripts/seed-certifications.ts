/**
 * Seed AWS Certifications with official exam metadata
 * Run with: npx ts-node scripts/seed-certifications.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// All AWS Certifications with official metadata
const certifications = [
  // ============================================
  // FOUNDATIONAL
  // ============================================
  {
    code: "CLF-C02",
    name: "AWS Certified Cloud Practitioner",
    shortName: "Cloud Practitioner",
    level: "foundational",
    category: "Cloud",
    questionCount: 65,
    timeMinutes: 90,
    passingScore: 700,
    passingPercentage: 70,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-cloud-practitioner/",
    version: "C02",
    domains: [
      { id: "1", name: "Cloud Concepts", weight: 24, taskStatements: [] },
      { id: "2", name: "Security and Compliance", weight: 30, taskStatements: [] },
      { id: "3", name: "Cloud Technology and Services", weight: 34, taskStatements: [] },
      { id: "4", name: "Billing, Pricing, and Support", weight: 12, taskStatements: [] },
    ],
  },
  {
    code: "AIF-C01",
    name: "AWS Certified AI Practitioner",
    shortName: "AI Practitioner",
    level: "foundational",
    category: "AI/ML",
    questionCount: 65,
    timeMinutes: 90,
    passingScore: 700,
    passingPercentage: 70,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-ai-practitioner/AWS-Certified-AI-Practitioner_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-ai-practitioner/AWS-Certified-AI-Practitioner_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-ai-practitioner/",
    version: "C01",
    domains: [
      { id: "1", name: "Fundamentals of AI and ML", weight: 20, taskStatements: [] },
      { id: "2", name: "Fundamentals of Generative AI", weight: 24, taskStatements: [] },
      { id: "3", name: "Applications of Foundation Models", weight: 28, taskStatements: [] },
      { id: "4", name: "Guidelines for Responsible AI", weight: 14, taskStatements: [] },
      { id: "5", name: "Security, Compliance, and Governance for AI Solutions", weight: 14, taskStatements: [] },
    ],
  },

  // ============================================
  // ASSOCIATE
  // ============================================
  {
    code: "SAA-C03",
    name: "AWS Certified Solutions Architect - Associate",
    shortName: "Solutions Architect Associate",
    level: "associate",
    category: "Architect",
    questionCount: 65,
    timeMinutes: 130,
    passingScore: 720,
    passingPercentage: 72,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-sa-assoc/AWS-Certified-Solutions-Architect-Associate_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-sa-assoc/AWS-Certified-Solutions-Architect-Associate_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
    version: "C03",
    domains: [
      { id: "1", name: "Design Secure Architectures", weight: 30, taskStatements: [] },
      { id: "2", name: "Design Resilient Architectures", weight: 26, taskStatements: [] },
      { id: "3", name: "Design High-Performing Architectures", weight: 24, taskStatements: [] },
      { id: "4", name: "Design Cost-Optimized Architectures", weight: 20, taskStatements: [] },
    ],
  },
  {
    code: "DVA-C02",
    name: "AWS Certified Developer - Associate",
    shortName: "Developer Associate",
    level: "associate",
    category: "Developer",
    questionCount: 65,
    timeMinutes: 130,
    passingScore: 720,
    passingPercentage: 72,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-dev-associate/AWS-Certified-Developer-Associate_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-dev-associate/AWS-Certified-Developer-Associate_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-developer-associate/",
    version: "C02",
    domains: [
      { id: "1", name: "Development with AWS Services", weight: 32, taskStatements: [] },
      { id: "2", name: "Security", weight: 26, taskStatements: [] },
      { id: "3", name: "Deployment", weight: 24, taskStatements: [] },
      { id: "4", name: "Troubleshooting and Optimization", weight: 18, taskStatements: [] },
    ],
  },
  {
    code: "SOA-C02",
    name: "AWS Certified SysOps Administrator - Associate",
    shortName: "SysOps Administrator Associate",
    level: "associate",
    category: "Operations",
    questionCount: 65,
    timeMinutes: 130,
    passingScore: 720,
    passingPercentage: 72,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-sysops-associate/AWS-Certified-SysOps-Administrator-Associate_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-sysops-associate/AWS-Certified-SysOps-Administrator-Associate_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-sysops-admin-associate/",
    version: "C02",
    domains: [
      { id: "1", name: "Monitoring, Logging, and Remediation", weight: 20, taskStatements: [] },
      { id: "2", name: "Reliability and Business Continuity", weight: 16, taskStatements: [] },
      { id: "3", name: "Deployment, Provisioning, and Automation", weight: 18, taskStatements: [] },
      { id: "4", name: "Security and Compliance", weight: 16, taskStatements: [] },
      { id: "5", name: "Networking and Content Delivery", weight: 18, taskStatements: [] },
      { id: "6", name: "Cost and Performance Optimization", weight: 12, taskStatements: [] },
    ],
  },
  {
    code: "DEA-C01",
    name: "AWS Certified Data Engineer - Associate",
    shortName: "Data Engineer Associate",
    level: "associate",
    category: "Data",
    questionCount: 65,
    timeMinutes: 130,
    passingScore: 720,
    passingPercentage: 72,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-data-engineer-associate/AWS-Certified-Data-Engineer-Associate_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-data-engineer-associate/AWS-Certified-Data-Engineer-Associate_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-data-engineer-associate/",
    version: "C01",
    domains: [
      { id: "1", name: "Data Ingestion and Transformation", weight: 34, taskStatements: [] },
      { id: "2", name: "Data Store Management", weight: 26, taskStatements: [] },
      { id: "3", name: "Data Operations and Support", weight: 22, taskStatements: [] },
      { id: "4", name: "Data Security and Governance", weight: 18, taskStatements: [] },
    ],
  },
  {
    code: "MLA-C01",
    name: "AWS Certified Machine Learning Engineer - Associate",
    shortName: "ML Engineer Associate",
    level: "associate",
    category: "AI/ML",
    questionCount: 65,
    timeMinutes: 130,
    passingScore: 720,
    passingPercentage: 72,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-ml-engineer-associate/AWS-Certified-Machine-Learning-Engineer-Associate_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-ml-engineer-associate/AWS-Certified-Machine-Learning-Engineer-Associate_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/",
    version: "C01",
    domains: [
      { id: "1", name: "Data Preparation for ML", weight: 28, taskStatements: [] },
      { id: "2", name: "ML Model Development", weight: 26, taskStatements: [] },
      { id: "3", name: "Deployment and Orchestration of ML Workflows", weight: 22, taskStatements: [] },
      { id: "4", name: "ML Solution Monitoring, Maintenance, and Security", weight: 24, taskStatements: [] },
    ],
  },

  // ============================================
  // PROFESSIONAL
  // ============================================
  {
    code: "SAP-C02",
    name: "AWS Certified Solutions Architect - Professional",
    shortName: "Solutions Architect Professional",
    level: "professional",
    category: "Architect",
    questionCount: 75,
    timeMinutes: 180,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-sa-pro/AWS-Certified-Solutions-Architect-Professional_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-sa-pro/AWS-Certified-Solutions-Architect-Professional_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-solutions-architect-professional/",
    version: "C02",
    domains: [
      { id: "1", name: "Design Solutions for Organizational Complexity", weight: 26, taskStatements: [] },
      { id: "2", name: "Design for New Solutions", weight: 29, taskStatements: [] },
      { id: "3", name: "Continuous Improvement for Existing Solutions", weight: 25, taskStatements: [] },
      { id: "4", name: "Accelerate Workload Migration and Modernization", weight: 20, taskStatements: [] },
    ],
  },
  {
    code: "DOP-C02",
    name: "AWS Certified DevOps Engineer - Professional",
    shortName: "DevOps Engineer Professional",
    level: "professional",
    category: "Operations",
    questionCount: 75,
    timeMinutes: 180,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-devops-pro/AWS-Certified-DevOps-Engineer-Professional_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-devops-pro/AWS-Certified-DevOps-Engineer-Professional_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-devops-engineer-professional/",
    version: "C02",
    domains: [
      { id: "1", name: "SDLC Automation", weight: 22, taskStatements: [] },
      { id: "2", name: "Configuration Management and IaC", weight: 17, taskStatements: [] },
      { id: "3", name: "Resilient Cloud Solutions", weight: 15, taskStatements: [] },
      { id: "4", name: "Monitoring and Logging", weight: 15, taskStatements: [] },
      { id: "5", name: "Incident and Event Response", weight: 14, taskStatements: [] },
      { id: "6", name: "Security and Compliance", weight: 17, taskStatements: [] },
    ],
  },

  // ============================================
  // SPECIALTY
  // ============================================
  {
    code: "SCS-C02",
    name: "AWS Certified Security - Specialty",
    shortName: "Security Specialty",
    level: "specialty",
    category: "Security",
    questionCount: 65,
    timeMinutes: 170,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-security-spec/AWS-Certified-Security-Specialty_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-security-spec/AWS-Certified-Security-Specialty_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-security-specialty/",
    version: "C02",
    domains: [
      { id: "1", name: "Threat Detection and Incident Response", weight: 14, taskStatements: [] },
      { id: "2", name: "Security Logging and Monitoring", weight: 18, taskStatements: [] },
      { id: "3", name: "Infrastructure Security", weight: 20, taskStatements: [] },
      { id: "4", name: "Identity and Access Management", weight: 16, taskStatements: [] },
      { id: "5", name: "Data Protection", weight: 18, taskStatements: [] },
      { id: "6", name: "Management and Security Governance", weight: 14, taskStatements: [] },
    ],
  },
  {
    code: "ANS-C01",
    name: "AWS Certified Advanced Networking - Specialty",
    shortName: "Advanced Networking Specialty",
    level: "specialty",
    category: "Networking",
    questionCount: 65,
    timeMinutes: 170,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-advnetworking-spec/AWS-Certified-Advanced-Networking-Specialty_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-advnetworking-spec/AWS-Certified-Advanced-Networking-Specialty_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-advanced-networking-specialty/",
    version: "C01",
    domains: [
      { id: "1", name: "Network Design", weight: 30, taskStatements: [] },
      { id: "2", name: "Network Implementation", weight: 26, taskStatements: [] },
      { id: "3", name: "Network Management and Operations", weight: 20, taskStatements: [] },
      { id: "4", name: "Network Security, Compliance, and Governance", weight: 24, taskStatements: [] },
    ],
  },
  {
    code: "MLS-C01",
    name: "AWS Certified Machine Learning - Specialty",
    shortName: "Machine Learning Specialty",
    level: "specialty",
    category: "AI/ML",
    questionCount: 65,
    timeMinutes: 180,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-ml/AWS-Certified-Machine-Learning-Specialty_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-ml/AWS-Certified-Machine-Learning-Specialty_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-machine-learning-specialty/",
    version: "C01",
    domains: [
      { id: "1", name: "Data Engineering", weight: 20, taskStatements: [] },
      { id: "2", name: "Exploratory Data Analysis", weight: 24, taskStatements: [] },
      { id: "3", name: "Modeling", weight: 36, taskStatements: [] },
      { id: "4", name: "Machine Learning Implementation and Operations", weight: 20, taskStatements: [] },
    ],
  },
  {
    code: "DBS-C01",
    name: "AWS Certified Database - Specialty",
    shortName: "Database Specialty",
    level: "specialty",
    category: "Data",
    questionCount: 65,
    timeMinutes: 180,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-database-specialty/AWS-Certified-Database-Specialty_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-database-specialty/AWS-Certified-Database-Specialty_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-database-specialty/",
    version: "C01",
    domains: [
      { id: "1", name: "Workload-Specific Database Design", weight: 26, taskStatements: [] },
      { id: "2", name: "Deployment and Migration", weight: 20, taskStatements: [] },
      { id: "3", name: "Management and Operations", weight: 18, taskStatements: [] },
      { id: "4", name: "Monitoring and Troubleshooting", weight: 18, taskStatements: [] },
      { id: "5", name: "Database Security", weight: 18, taskStatements: [] },
    ],
  },
  {
    code: "PAS-C01",
    name: "AWS Certified SAP on AWS - Specialty",
    shortName: "SAP on AWS Specialty",
    level: "specialty",
    category: "SAP",
    questionCount: 65,
    timeMinutes: 170,
    passingScore: 750,
    passingPercentage: 75,
    examGuideUrl: "https://d1.awsstatic.com/training-and-certification/docs-sap-on-aws-specialty/AWS-Certified-SAP-on-AWS-Specialty_Exam-Guide.pdf",
    sampleQuestionsUrl: "https://d1.awsstatic.com/training-and-certification/docs-sap-on-aws-specialty/AWS-Certified-SAP-on-AWS-Specialty_Sample-Questions.pdf",
    awsPageUrl: "https://aws.amazon.com/certification/certified-sap-on-aws-specialty/",
    version: "C01",
    domains: [
      { id: "1", name: "Design of SAP Workloads on AWS", weight: 30, taskStatements: [] },
      { id: "2", name: "Implementation of SAP Workloads on AWS", weight: 24, taskStatements: [] },
      { id: "3", name: "Migration of SAP Workloads to AWS", weight: 26, taskStatements: [] },
      { id: "4", name: "Operation and Maintenance of SAP Workloads on AWS", weight: 20, taskStatements: [] },
    ],
  },
];

async function main() {
  console.log("🎓 Seeding AWS Certifications...\n");

  for (const cert of certifications) {
    console.log(`Creating ${cert.code} - ${cert.shortName}...`);
    
    await prisma.aWSCertification.upsert({
      where: { code: cert.code },
      update: {
        ...cert,
        domains: cert.domains,
      },
      create: {
        ...cert,
        domains: cert.domains,
      },
    });
    
    console.log(`  ✅ ${cert.code} created`);
  }

  // Summary by level
  const foundational = certifications.filter(c => c.level === "foundational").length;
  const associate = certifications.filter(c => c.level === "associate").length;
  const professional = certifications.filter(c => c.level === "professional").length;
  const specialty = certifications.filter(c => c.level === "specialty").length;

  console.log("\n✨ AWS Certifications seeding complete!");
  console.log(`   - Foundational: ${foundational}`);
  console.log(`   - Associate: ${associate}`);
  console.log(`   - Professional: ${professional}`);
  console.log(`   - Specialty: ${specialty}`);
  console.log(`   - Total: ${certifications.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
