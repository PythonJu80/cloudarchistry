/**
 * Seed script for Practice Exams
 * Run with: npx ts-node scripts/seed-exams.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// AWS Solutions Architect Associate (SAA-C03) Exam
const saaExam = {
  slug: "saa-c03",
  title: "AWS Solutions Architect Associate",
  shortTitle: "SAA-C03",
  certificationCode: "SAA-C03",
  description: "Prepare for the AWS Solutions Architect Associate certification. This practice exam covers designing resilient architectures, high-performing architectures, secure applications, and cost-optimized architectures.",
  questionCount: 65,
  timeLimit: 130,
  passingScore: 72,
  isFree: true, // First exam is free
  requiredTier: "free",
  icon: "🏗️",
  color: "#FF9900",
  difficulty: "associate",
  domains: [
    { id: "domain1", name: "Design Secure Architectures", weight: 30 },
    { id: "domain2", name: "Design Resilient Architectures", weight: 26 },
    { id: "domain3", name: "Design High-Performing Architectures", weight: 24 },
    { id: "domain4", name: "Design Cost-Optimized Architectures", weight: 20 },
  ],
};

// Sample questions for SAA-C03
const saaQuestions = [
  {
    questionText: "A company is planning to migrate a legacy application to AWS. The application requires a relational database with high availability and automatic failover. The database must support MySQL and have minimal administrative overhead. Which AWS service should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Amazon RDS for MySQL with Multi-AZ deployment" },
      { id: "B", text: "Amazon EC2 with MySQL installed and configured for replication" },
      { id: "C", text: "Amazon DynamoDB with global tables" },
      { id: "D", text: "Amazon Redshift with automatic snapshots" },
    ],
    correctAnswers: ["A"],
    explanation: "Amazon RDS for MySQL with Multi-AZ deployment provides high availability and automatic failover with minimal administrative overhead. RDS handles backups, patching, and failover automatically. Multi-AZ creates a synchronous standby replica in a different Availability Zone for automatic failover.",
    whyCorrect: "RDS Multi-AZ provides automatic failover, managed backups, and minimal admin overhead - exactly what the question requires.",
    whyWrong: {
      "B": "EC2 with MySQL requires significant administrative overhead for replication, patching, backups, and failover configuration.",
      "C": "DynamoDB is a NoSQL database, not a relational database. It doesn't support MySQL.",
      "D": "Redshift is a data warehouse service, not suitable for transactional workloads. It doesn't support MySQL.",
    },
    domain: "Design Resilient Architectures",
    subdomain: "Design highly available and/or fault-tolerant architectures",
    awsServices: ["Amazon RDS", "MySQL", "Multi-AZ"],
    difficulty: "medium",
    referenceLinks: [
      { title: "Amazon RDS Multi-AZ Deployments", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html" },
    ],
    tags: ["rds", "high-availability", "mysql", "multi-az"],
  },
  {
    questionText: "A company needs to store sensitive customer data in Amazon S3. The data must be encrypted at rest using keys managed by the company. The company wants to maintain full control over the encryption keys and be able to rotate them annually. Which encryption option should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Server-side encryption with Amazon S3 managed keys (SSE-S3)" },
      { id: "B", text: "Server-side encryption with AWS KMS managed keys (SSE-KMS) using AWS managed keys" },
      { id: "C", text: "Server-side encryption with AWS KMS managed keys (SSE-KMS) using customer managed keys" },
      { id: "D", text: "Client-side encryption with keys stored in AWS Secrets Manager" },
    ],
    correctAnswers: ["C"],
    explanation: "SSE-KMS with customer managed keys (CMKs) provides the company with full control over their encryption keys. Customer managed keys allow the company to define key policies, enable/disable keys, and configure automatic annual key rotation. This meets all the requirements: encryption at rest, company-managed keys, and annual rotation capability.",
    whyCorrect: "Customer managed KMS keys provide full control over key policies, access, and automatic rotation - meeting all stated requirements.",
    whyWrong: {
      "A": "SSE-S3 uses keys managed entirely by AWS. The company cannot control or rotate these keys.",
      "B": "AWS managed keys are controlled by AWS, not the customer. Rotation is automatic but not configurable.",
      "D": "While this provides control, it adds complexity and doesn't leverage AWS's integrated encryption. Secrets Manager is for secrets, not encryption keys.",
    },
    domain: "Design Secure Architectures",
    subdomain: "Design secure access to AWS resources",
    awsServices: ["Amazon S3", "AWS KMS", "SSE-KMS"],
    difficulty: "medium",
    referenceLinks: [
      { title: "Protecting data using encryption", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html" },
      { title: "AWS KMS concepts", url: "https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html" },
    ],
    tags: ["s3", "encryption", "kms", "security"],
  },
  {
    questionText: "A web application running on Amazon EC2 instances behind an Application Load Balancer experiences traffic spikes during business hours. The application team wants to ensure the application can handle the increased load while minimizing costs during off-peak hours. Which solution should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Use Amazon EC2 Auto Scaling with a target tracking scaling policy based on CPU utilization" },
      { id: "B", text: "Manually add EC2 instances during business hours and remove them after hours" },
      { id: "C", text: "Use larger EC2 instance types that can handle peak traffic at all times" },
      { id: "D", text: "Deploy the application on a single large EC2 instance with enhanced networking" },
    ],
    correctAnswers: ["A"],
    explanation: "EC2 Auto Scaling with target tracking automatically adjusts the number of instances based on a target metric like CPU utilization. This ensures the application scales out during traffic spikes and scales in during off-peak hours, optimizing both performance and cost. Target tracking is simpler to configure than step scaling and maintains the target metric automatically.",
    whyCorrect: "Auto Scaling with target tracking automatically handles scaling based on demand, optimizing both performance during peaks and costs during off-peak hours.",
    whyWrong: {
      "B": "Manual scaling is error-prone, requires constant monitoring, and doesn't respond to unexpected traffic changes.",
      "C": "Over-provisioning with larger instances wastes money during off-peak hours and doesn't address the cost optimization requirement.",
      "D": "A single instance is a single point of failure and cannot scale to handle traffic spikes.",
    },
    domain: "Design High-Performing Architectures",
    subdomain: "Design scalable and loosely coupled architectures",
    awsServices: ["Amazon EC2", "Auto Scaling", "Application Load Balancer"],
    difficulty: "easy",
    referenceLinks: [
      { title: "Target tracking scaling policies", url: "https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html" },
    ],
    tags: ["auto-scaling", "ec2", "cost-optimization", "scalability"],
  },
  {
    questionText: "A company wants to reduce costs for their development and testing environments that run on Amazon EC2. These workloads can tolerate interruptions and run for varying lengths of time. Which EC2 purchasing option provides the MOST cost savings?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "On-Demand Instances" },
      { id: "B", text: "Reserved Instances with a 1-year term" },
      { id: "C", text: "Spot Instances" },
      { id: "D", text: "Dedicated Hosts" },
    ],
    correctAnswers: ["C"],
    explanation: "Spot Instances offer up to 90% discount compared to On-Demand prices. They are ideal for workloads that can tolerate interruptions, such as development and testing environments. When AWS needs the capacity back, Spot Instances receive a two-minute warning before termination. Since the workloads can tolerate interruptions and run for varying lengths, Spot Instances are the most cost-effective option.",
    whyCorrect: "Spot Instances provide up to 90% savings and are perfect for interruptible workloads like dev/test environments.",
    whyWrong: {
      "A": "On-Demand provides flexibility but no discount. It's the most expensive option for this use case.",
      "B": "Reserved Instances require a commitment and are best for steady-state workloads, not variable dev/test environments.",
      "D": "Dedicated Hosts are the most expensive option, used for licensing requirements or compliance, not cost savings.",
    },
    domain: "Design Cost-Optimized Architectures",
    subdomain: "Design cost-optimized compute solutions",
    awsServices: ["Amazon EC2", "Spot Instances"],
    difficulty: "easy",
    referenceLinks: [
      { title: "Amazon EC2 Spot Instances", url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html" },
    ],
    tags: ["ec2", "spot-instances", "cost-optimization"],
  },
  {
    questionText: "A company is designing a three-tier web application. The application tier needs to communicate with a PostgreSQL database. The database credentials must be stored securely and rotated automatically every 30 days. Which AWS service should the solutions architect use to meet these requirements?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "AWS Systems Manager Parameter Store with SecureString parameters" },
      { id: "B", text: "AWS Secrets Manager with automatic rotation enabled" },
      { id: "C", text: "Amazon S3 with server-side encryption" },
      { id: "D", text: "AWS Key Management Service (KMS) with automatic key rotation" },
    ],
    correctAnswers: ["B"],
    explanation: "AWS Secrets Manager is designed specifically for managing secrets like database credentials. It provides automatic rotation of secrets with built-in integration for Amazon RDS databases including PostgreSQL. You can configure rotation schedules (like every 30 days) and Secrets Manager handles the rotation automatically using Lambda functions.",
    whyCorrect: "Secrets Manager provides secure storage AND automatic rotation of database credentials with native RDS integration.",
    whyWrong: {
      "A": "Parameter Store can store secrets but doesn't have built-in automatic rotation. You would need to build custom rotation logic.",
      "C": "S3 is not designed for storing secrets. It lacks rotation capabilities and proper access patterns for credentials.",
      "D": "KMS manages encryption keys, not secrets like database credentials. Key rotation is different from credential rotation.",
    },
    domain: "Design Secure Architectures",
    subdomain: "Design secure access to AWS resources",
    awsServices: ["AWS Secrets Manager", "Amazon RDS", "PostgreSQL"],
    difficulty: "medium",
    referenceLinks: [
      { title: "AWS Secrets Manager", url: "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html" },
      { title: "Rotating secrets", url: "https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html" },
    ],
    tags: ["secrets-manager", "security", "rotation", "rds"],
  },
  {
    questionText: "A company has a stateless web application that experiences unpredictable traffic patterns. The application needs to scale from zero to thousands of requests per second within seconds. The company wants to minimize operational overhead. Which compute solution should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Amazon EC2 instances with Auto Scaling" },
      { id: "B", text: "AWS Lambda with API Gateway" },
      { id: "C", text: "Amazon ECS with Fargate" },
      { id: "D", text: "Amazon EC2 Spot Fleet" },
    ],
    correctAnswers: ["B"],
    explanation: "AWS Lambda with API Gateway is ideal for stateless applications with unpredictable traffic. Lambda automatically scales from zero to handle thousands of concurrent requests within milliseconds. There's no infrastructure to manage, and you only pay for actual compute time used. API Gateway handles the HTTP layer and integrates seamlessly with Lambda.",
    whyCorrect: "Lambda scales instantly from zero, requires no infrastructure management, and is perfect for stateless, unpredictable workloads.",
    whyWrong: {
      "A": "EC2 Auto Scaling takes minutes to launch new instances, not seconds. It also requires managing the underlying infrastructure.",
      "C": "ECS with Fargate is good for containers but takes longer to scale than Lambda and has more operational overhead.",
      "D": "Spot Fleet is for batch workloads and can be interrupted. It doesn't scale as quickly as Lambda.",
    },
    domain: "Design High-Performing Architectures",
    subdomain: "Design scalable and loosely coupled architectures",
    awsServices: ["AWS Lambda", "Amazon API Gateway"],
    difficulty: "medium",
    referenceLinks: [
      { title: "AWS Lambda", url: "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html" },
    ],
    tags: ["lambda", "serverless", "api-gateway", "scalability"],
  },
  {
    questionText: "A company needs to migrate 50 TB of data from an on-premises data center to Amazon S3. The company has a 100 Mbps internet connection. The migration must be completed within one week. Which solution should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Transfer the data over the internet using the AWS CLI" },
      { id: "B", text: "Use AWS Snowball Edge to transfer the data" },
      { id: "C", text: "Set up AWS Direct Connect and transfer the data" },
      { id: "D", text: "Use Amazon S3 Transfer Acceleration" },
    ],
    correctAnswers: ["B"],
    explanation: "At 100 Mbps, transferring 50 TB would take approximately 46 days (50 TB × 8 bits × 1024³ / 100 Mbps / 86400 seconds). This exceeds the one-week requirement. AWS Snowball Edge is a physical device that can store up to 80 TB and can be shipped to your location, loaded with data, and shipped back to AWS within days. This is the only option that meets the timeline.",
    whyCorrect: "Snowball Edge physically ships data, bypassing network limitations. It can transfer 50 TB within the one-week timeline.",
    whyWrong: {
      "A": "At 100 Mbps, internet transfer would take ~46 days, far exceeding the one-week requirement.",
      "C": "Direct Connect takes weeks to months to provision. It won't be ready in time for the migration.",
      "D": "Transfer Acceleration improves speed but still relies on the 100 Mbps connection, which is too slow.",
    },
    domain: "Design Resilient Architectures",
    subdomain: "Design solutions for data migration",
    awsServices: ["AWS Snowball", "Amazon S3"],
    difficulty: "medium",
    referenceLinks: [
      { title: "AWS Snowball Edge", url: "https://docs.aws.amazon.com/snowball/latest/developer-guide/whatisedge.html" },
    ],
    tags: ["snowball", "migration", "s3", "data-transfer"],
  },
  {
    questionText: "A company is running a critical production workload on Amazon EC2. The workload requires the lowest possible latency for network communication between instances. All instances are in the same Availability Zone. Which solution should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Deploy instances in a placement group with cluster strategy" },
      { id: "B", text: "Deploy instances in a placement group with spread strategy" },
      { id: "C", text: "Deploy instances in a placement group with partition strategy" },
      { id: "D", text: "Deploy instances with enhanced networking enabled across multiple AZs" },
    ],
    correctAnswers: ["A"],
    explanation: "A cluster placement group packs instances close together inside an Availability Zone. This provides the lowest network latency and highest network throughput between instances. Cluster placement groups are ideal for HPC applications, tightly-coupled workloads, and any application that requires low-latency network performance.",
    whyCorrect: "Cluster placement groups provide the lowest latency by placing instances physically close together in the same AZ.",
    whyWrong: {
      "B": "Spread placement groups distribute instances across hardware to reduce correlated failures, not to minimize latency.",
      "C": "Partition placement groups are for large distributed workloads like HDFS and Cassandra, not for low-latency requirements.",
      "D": "Multiple AZs increase latency due to the physical distance between data centers.",
    },
    domain: "Design High-Performing Architectures",
    subdomain: "Design high-performing networking solutions",
    awsServices: ["Amazon EC2", "Placement Groups"],
    difficulty: "medium",
    referenceLinks: [
      { title: "Placement groups", url: "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html" },
    ],
    tags: ["ec2", "placement-groups", "networking", "low-latency"],
  },
  {
    questionText: "A company wants to implement a disaster recovery solution for their web application. The application runs on Amazon EC2 instances behind an Application Load Balancer in us-east-1. The company requires an RTO of 1 hour and an RPO of 15 minutes. Which disaster recovery strategy should the solutions architect recommend?",
    questionType: "single",
    selectCount: 1,
    options: [
      { id: "A", text: "Backup and restore" },
      { id: "B", text: "Pilot light" },
      { id: "C", text: "Warm standby" },
      { id: "D", text: "Multi-site active-active" },
    ],
    correctAnswers: ["C"],
    explanation: "Warm standby maintains a scaled-down but fully functional copy of the production environment in another region. It can be scaled up quickly during a disaster. With RTO of 1 hour and RPO of 15 minutes, warm standby is appropriate as it can meet these requirements while being more cost-effective than multi-site active-active.",
    whyCorrect: "Warm standby provides a running environment that can be scaled up within an hour, meeting the 1-hour RTO. Continuous replication meets the 15-minute RPO.",
    whyWrong: {
      "A": "Backup and restore has the longest RTO (hours to days) and may not meet the 1-hour requirement.",
      "B": "Pilot light keeps only core services running. Scaling up the full environment may exceed the 1-hour RTO.",
      "D": "Multi-site active-active provides near-zero RTO/RPO but is more expensive than needed for these requirements.",
    },
    domain: "Design Resilient Architectures",
    subdomain: "Design disaster recovery solutions",
    awsServices: ["Amazon EC2", "Application Load Balancer", "AWS Backup"],
    difficulty: "hard",
    referenceLinks: [
      { title: "Disaster Recovery Workloads", url: "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" },
    ],
    tags: ["disaster-recovery", "rto", "rpo", "warm-standby"],
  },
  {
    questionText: "A company needs to process and analyze streaming data from IoT sensors in real-time. The data must be stored for later batch analysis. Which combination of AWS services should the solutions architect recommend? (Select TWO)",
    questionType: "multiple",
    selectCount: 2,
    options: [
      { id: "A", text: "Amazon Kinesis Data Streams" },
      { id: "B", text: "Amazon SQS" },
      { id: "C", text: "Amazon Kinesis Data Firehose" },
      { id: "D", text: "Amazon SNS" },
      { id: "E", text: "AWS Batch" },
    ],
    correctAnswers: ["A", "C"],
    explanation: "Amazon Kinesis Data Streams can ingest and process streaming data in real-time. Amazon Kinesis Data Firehose can deliver the processed data to storage destinations like Amazon S3 for later batch analysis. Together, they provide a complete solution for real-time processing and durable storage of streaming data.",
    whyCorrect: "Kinesis Data Streams handles real-time ingestion and processing. Kinesis Data Firehose delivers data to S3 for batch analysis.",
    whyWrong: {
      "B": "SQS is a message queue, not designed for real-time streaming analytics. It doesn't provide the throughput needed for IoT data.",
      "D": "SNS is a pub/sub notification service, not suitable for processing or storing streaming data.",
      "E": "AWS Batch is for batch processing jobs, not real-time streaming data processing.",
    },
    domain: "Design High-Performing Architectures",
    subdomain: "Design data processing solutions",
    awsServices: ["Amazon Kinesis Data Streams", "Amazon Kinesis Data Firehose", "Amazon S3"],
    difficulty: "medium",
    referenceLinks: [
      { title: "Amazon Kinesis Data Streams", url: "https://docs.aws.amazon.com/streams/latest/dev/introduction.html" },
      { title: "Amazon Kinesis Data Firehose", url: "https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html" },
    ],
    tags: ["kinesis", "streaming", "iot", "real-time"],
  },
];

// Additional exams (without questions for now)
const additionalExams = [
  {
    slug: "sap-c02",
    title: "AWS Solutions Architect Professional",
    shortTitle: "SAP-C02",
    certificationCode: "SAP-C02",
    description: "Advanced practice exam for the AWS Solutions Architect Professional certification. Covers complex multi-account architectures, migrations, and enterprise-scale solutions.",
    questionCount: 75,
    timeLimit: 180,
    passingScore: 75,
    isFree: false,
    requiredTier: "learner",
    icon: "🎯",
    color: "#8B5CF6",
    difficulty: "professional",
    domains: [
      { id: "domain1", name: "Design Solutions for Organizational Complexity", weight: 26 },
      { id: "domain2", name: "Design for New Solutions", weight: 29 },
      { id: "domain3", name: "Continuous Improvement for Existing Solutions", weight: 25 },
      { id: "domain4", name: "Accelerate Workload Migration and Modernization", weight: 20 },
    ],
  },
  {
    slug: "dva-c02",
    title: "AWS Developer Associate",
    shortTitle: "DVA-C02",
    certificationCode: "DVA-C02",
    description: "Practice exam for the AWS Developer Associate certification. Covers development with AWS services, deployment, security, and troubleshooting.",
    questionCount: 65,
    timeLimit: 130,
    passingScore: 72,
    isFree: false,
    requiredTier: "learner",
    icon: "💻",
    color: "#10B981",
    difficulty: "associate",
    domains: [
      { id: "domain1", name: "Development with AWS Services", weight: 32 },
      { id: "domain2", name: "Security", weight: 26 },
      { id: "domain3", name: "Deployment", weight: 24 },
      { id: "domain4", name: "Troubleshooting and Optimization", weight: 18 },
    ],
  },
  {
    slug: "clf-c02",
    title: "AWS Cloud Practitioner",
    shortTitle: "CLF-C02",
    certificationCode: "CLF-C02",
    description: "Entry-level practice exam for the AWS Cloud Practitioner certification. Covers cloud concepts, AWS services, security, and pricing.",
    questionCount: 65,
    timeLimit: 90,
    passingScore: 70,
    isFree: false,
    requiredTier: "learner",
    icon: "☁️",
    color: "#3B82F6",
    difficulty: "foundational",
    domains: [
      { id: "domain1", name: "Cloud Concepts", weight: 24 },
      { id: "domain2", name: "Security and Compliance", weight: 30 },
      { id: "domain3", name: "Cloud Technology and Services", weight: 34 },
      { id: "domain4", name: "Billing, Pricing, and Support", weight: 12 },
    ],
  },
  {
    slug: "scs-c02",
    title: "AWS Security Specialty",
    shortTitle: "SCS-C02",
    certificationCode: "SCS-C02",
    description: "Specialty practice exam for AWS Security. Covers incident response, logging, infrastructure security, identity management, and data protection.",
    questionCount: 65,
    timeLimit: 170,
    passingScore: 75,
    isFree: false,
    requiredTier: "pro",
    icon: "🔐",
    color: "#EF4444",
    difficulty: "specialty",
    domains: [
      { id: "domain1", name: "Threat Detection and Incident Response", weight: 14 },
      { id: "domain2", name: "Security Logging and Monitoring", weight: 18 },
      { id: "domain3", name: "Infrastructure Security", weight: 20 },
      { id: "domain4", name: "Identity and Access Management", weight: 16 },
      { id: "domain5", name: "Data Protection", weight: 18 },
      { id: "domain6", name: "Management and Security Governance", weight: 14 },
    ],
  },
];

async function main() {
  console.log("🎓 Seeding Practice Exams...\n");

  // Create SAA-C03 exam with questions
  console.log("Creating AWS Solutions Architect Associate (SAA-C03)...");
  const exam = await prisma.practiceExam.upsert({
    where: { slug: saaExam.slug },
    update: {
      ...saaExam,
      totalQuestions: saaQuestions.length,
    },
    create: {
      ...saaExam,
      totalQuestions: saaQuestions.length,
    },
  });

  // Create questions for SAA-C03
  console.log(`  Adding ${saaQuestions.length} questions...`);
  for (const q of saaQuestions) {
    await prisma.examQuestion.create({
      data: {
        ...q,
        examId: exam.id,
      },
    });
  }
  console.log("  ✅ SAA-C03 created with questions\n");

  // Create additional exams (without questions)
  for (const examData of additionalExams) {
    console.log(`Creating ${examData.title}...`);
    await prisma.practiceExam.upsert({
      where: { slug: examData.slug },
      update: examData,
      create: examData,
    });
    console.log(`  ✅ ${examData.shortTitle} created (no questions yet)\n`);
  }

  console.log("✨ Practice Exams seeding complete!");
  console.log(`   - ${1 + additionalExams.length} exams created`);
  console.log(`   - ${saaQuestions.length} questions for SAA-C03`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
