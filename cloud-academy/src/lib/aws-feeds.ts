// AWS Official Blog RSS Feeds - Organized by priority for cloud migration learning

export interface AWSFeed {
  name: string;
  url: string;
  description?: string;
}

export interface AWSFeedCategory {
  name: string;
  priority: "core" | "secondary" | "specialized";
  description: string;
  feeds: AWSFeed[];
}

export const AWS_FEED_CATEGORIES: AWSFeedCategory[] = [
  // CORE - Essential for cloud migration learning
  {
    name: "Architecture & Design",
    priority: "core",
    description: "Solution design patterns and best practices",
    feeds: [
      { name: "Architecture", url: "https://aws.amazon.com/blogs/architecture/feed/", description: "AWS architecture patterns and best practices" },
    ],
  },
  {
    name: "Core Services",
    priority: "core",
    description: "Compute, containers, databases, and storage",
    feeds: [
      { name: "Compute", url: "https://aws.amazon.com/blogs/compute/feed/", description: "EC2, Lambda, and compute services" },
      { name: "Containers", url: "https://aws.amazon.com/blogs/containers/feed/", description: "ECS, EKS, and container orchestration" },
      { name: "Database", url: "https://aws.amazon.com/blogs/database/feed/", description: "RDS, Aurora, DynamoDB updates" },
      { name: "Storage", url: "https://aws.amazon.com/blogs/storage/feed/", description: "S3, EFS, EBS, and storage solutions" },
    ],
  },
  {
    name: "Security & Compliance",
    priority: "core",
    description: "Security best practices and compliance",
    feeds: [
      { name: "Security, Identity, & Compliance", url: "https://aws.amazon.com/blogs/security/feed/", description: "IAM, security best practices, compliance" },
    ],
  },
  {
    name: "Networking",
    priority: "core",
    description: "VPC, networking, and content delivery",
    feeds: [
      { name: "Networking & Content Delivery", url: "https://aws.amazon.com/blogs/networking-and-content-delivery/feed/", description: "VPC, CloudFront, Route 53" },
    ],
  },
  {
    name: "DevOps & Automation",
    priority: "core",
    description: "CI/CD and infrastructure automation",
    feeds: [
      { name: "DevOps", url: "https://aws.amazon.com/blogs/devops/feed/", description: "CI/CD pipelines and DevOps practices" },
      { name: "Infrastructure & Automation", url: "https://aws.amazon.com/blogs/infrastructure-and-automation/feed/", description: "CloudFormation, CDK, automation" },
    ],
  },

  // SECONDARY - Complementary topics
  {
    name: "AWS News & Updates",
    priority: "secondary",
    description: "General announcements and news",
    feeds: [
      { name: "AWS News", url: "https://aws.amazon.com/blogs/aws/feed/", description: "Official AWS announcements" },
      { name: "AWS Podcast", url: "https://d3gih7jbfe3jlq.cloudfront.net/aws-podcast.rss", description: "Weekly AWS podcast episodes" },
    ],
  },
  {
    name: "Data & Analytics",
    priority: "secondary",
    description: "Big data, ML, and analytics services",
    feeds: [
      { name: "Big Data", url: "https://aws.amazon.com/blogs/big-data/feed/", description: "EMR, Redshift, data lakes" },
      { name: "Machine Learning", url: "https://aws.amazon.com/blogs/machine-learning/feed/", description: "SageMaker, AI/ML services" },
    ],
  },
  {
    name: "Management & Governance",
    priority: "secondary",
    description: "Cloud management and Well-Architected",
    feeds: [
      { name: "Management & Governance", url: "https://aws.amazon.com/blogs/mt/feed/", description: "CloudWatch, Organizations, governance" },
      { name: "AWS Cost Management", url: "https://aws.amazon.com/blogs/aws-cost-management/feed/", description: "Cost optimization and budgeting" },
    ],
  },
  {
    name: "Development",
    priority: "secondary",
    description: "Developer tools and SDKs",
    feeds: [
      { name: "Developer", url: "https://aws.amazon.com/blogs/developer/feed/", description: "SDKs, tools, developer experience" },
      { name: "Front-End Web & Mobile", url: "https://aws.amazon.com/blogs/mobile/feed/", description: "Amplify, AppSync, mobile development" },
      { name: "Open Source", url: "https://aws.amazon.com/blogs/opensource/feed/", description: "AWS open source projects" },
    ],
  },
  {
    name: "Training & Certification",
    priority: "secondary",
    description: "Learning paths and certifications",
    feeds: [
      { name: "Training & Certification", url: "https://aws.amazon.com/blogs/training-and-certification/feed/", description: "Certification updates and learning resources" },
    ],
  },

  // SPECIALIZED - Niche domains
  {
    name: "Enterprise & Strategy",
    priority: "specialized",
    description: "Enterprise adoption and business strategy",
    feeds: [
      { name: "Enterprise Strategy", url: "https://aws.amazon.com/blogs/enterprise-strategy/feed/", description: "Cloud adoption for enterprises" },
      { name: "Startups", url: "https://aws.amazon.com/blogs/startups/feed/", description: "Startup-focused content" },
      { name: "AWS Partner Network", url: "https://aws.amazon.com/blogs/apn/feed/", description: "Partner ecosystem updates" },
    ],
  },
  {
    name: "Industry Solutions",
    priority: "specialized",
    description: "Vertical-specific solutions",
    feeds: [
      { name: "Industries", url: "https://aws.amazon.com/blogs/industries/feed/", description: "Industry-specific solutions" },
      { name: "Public Sector", url: "https://aws.amazon.com/blogs/publicsector/feed/", description: "Government and public sector" },
      { name: "Media", url: "https://aws.amazon.com/blogs/media/feed/", description: "Media and entertainment" },
      { name: "Game Tech", url: "https://aws.amazon.com/blogs/gametech/feed/", description: "Game development on AWS" },
    ],
  },
  {
    name: "Specialized Services",
    priority: "specialized",
    description: "Emerging and niche technologies",
    feeds: [
      { name: "HPC", url: "https://aws.amazon.com/blogs/hpc/feed/", description: "High-performance computing" },
      { name: "Quantum Computing", url: "https://aws.amazon.com/blogs/quantum-computing/feed/", description: "Amazon Braket and quantum" },
      { name: "Robotics", url: "https://aws.amazon.com/blogs/robotics/feed/", description: "AWS RoboMaker" },
      { name: "Internet of Things", url: "https://aws.amazon.com/blogs/iot/feed/", description: "AWS IoT services" },
      { name: "SAP", url: "https://aws.amazon.com/blogs/awsforsap/feed/", description: "SAP on AWS" },
    ],
  },
  {
    name: "Communication & Productivity",
    priority: "specialized",
    description: "Messaging, email, and productivity",
    feeds: [
      { name: "Business Productivity", url: "https://aws.amazon.com/blogs/business-productivity/feed/", description: "WorkSpaces, WorkDocs" },
      { name: "Contact Center", url: "https://aws.amazon.com/blogs/contact-center/feed/", description: "Amazon Connect" },
      { name: "Messaging & Targeting", url: "https://aws.amazon.com/blogs/messaging-and-targeting/feed/", description: "SES, Pinpoint, SNS" },
      { name: "Desktop & Application Streaming", url: "https://aws.amazon.com/blogs/desktop-and-application-streaming/feed/", description: "WorkSpaces, AppStream" },
      { name: "AWS Marketplace", url: "https://aws.amazon.com/blogs/awsmarketplace/feed/", description: "Marketplace listings and updates" },
    ],
  },
];

// Helper to get feeds by priority
export function getFeedsByPriority(priority: "core" | "secondary" | "specialized"): AWSFeedCategory[] {
  return AWS_FEED_CATEGORIES.filter((cat) => cat.priority === priority);
}

// Helper to get all feeds flat
export function getAllFeeds(): AWSFeed[] {
  return AWS_FEED_CATEGORIES.flatMap((cat) => cat.feeds);
}

// Priority display config
export const PRIORITY_CONFIG = {
  core: {
    label: "Core",
    description: "Essential for cloud migration",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  secondary: {
    label: "Complementary",
    description: "Expand your knowledge",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  specialized: {
    label: "Specialized",
    description: "Domain-specific topics",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
};
