/**
 * Import AWS Practice Questions from GitHub Repositories
 * 
 * Sources: Ditectrev open-source question banks
 * Format: Markdown with [x] marking correct answers
 * 
 * Run with: npx tsx scripts/import-github-questions.ts
 */

import { PrismaClient } from "@prisma/client";
import * as https from "https";

const prisma = new PrismaClient();

// GitHub raw URLs for question banks
const GITHUB_SOURCES = [
  {
    certCode: "CLF-C02",
    name: "Cloud Practitioner",
    url: "https://raw.githubusercontent.com/Ditectrev/Amazon-Web-Services-AWS-Certified-Cloud-Practitioner-CLF-C02-Practice-Tests-Exams-Questions-Answers/main/README.md",
  },
  {
    certCode: "SAA-C03",
    name: "Solutions Architect Associate",
    url: "https://raw.githubusercontent.com/Ditectrev/AWS-Certified-Solutions-Architect-Associate-SAA-C03-Practice-Tests-Exams-Questions-Answers/main/README.md",
  },
  {
    certCode: "DVA-C02",
    name: "Developer Associate",
    url: "https://raw.githubusercontent.com/Ditectrev/Amazon-Web-Services-AWS-Developer-Associate-DVA-C02-Practice-Tests-Exams-Questions-Answers/main/README.md",
  },
  {
    certCode: "SOA-C02",
    name: "SysOps Administrator Associate",
    url: "https://raw.githubusercontent.com/Ditectrev/AWS-Certified-SysOps-Administrator-Associate-SOA-C02-Practice-Tests-Exams-Questions-Answers/main/README.md",
  },
  {
    certCode: "SAP-C02",
    name: "Solutions Architect Professional",
    url: "https://raw.githubusercontent.com/Ditectrev/AWS-Certified-Solutions-Architect-Professional-SAP-C02-Practice-Tests-Exams-Questions-Answers/main/README.md",
  },
  {
    certCode: "SCS-C02",
    name: "Security Specialty",
    url: "https://raw.githubusercontent.com/Ditectrev/Amazon-Web-Services-Certified-AWS-Certified-Security-Specialty-SCS-C02-Practice-Tests-Exams-Question/main/README.md",
  },
];

interface ParsedQuestion {
  questionText: string;
  questionType: "single" | "multiple";
  selectCount: number;
  options: { id: string; text: string; isCorrect: boolean }[];
  correctAnswers: string[];
}

/**
 * Fetch markdown content from GitHub
 */
async function fetchMarkdown(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'CloudAcademy-QuestionImporter/1.0',
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          fetchMarkdown(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${response.statusCode}`));
        return;
      }
      
      let data = "";
      response.on("data", (chunk) => data += chunk);
      response.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

/**
 * Parse markdown questions from Ditectrev format
 * Format:
 * ### Question text here?
 * - [ ] Wrong answer
 * - [x] Correct answer
 * - [ ] Wrong answer
 */
function parseMarkdownQuestions(markdown: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  // Split by ### headers (questions)
  const sections = markdown.split(/\n### /);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Skip non-question sections
    if (section.startsWith("Table of Contents") || 
        section.startsWith("⬆️") ||
        section.startsWith("❣️") ||
        section.startsWith("✨") ||
        !section.includes("- [")) {
      continue;
    }
    
    try {
      const parsed = parseQuestionSection(section);
      if (parsed && parsed.options.length >= 2) {
        questions.push(parsed);
      }
    } catch (err) {
      // Skip unparseable questions
    }
  }
  
  return questions;
}

/**
 * Parse a single question section
 */
function parseQuestionSection(section: string): ParsedQuestion | null {
  const lines = section.split("\n");
  
  // First line is the question (may span multiple lines until we hit options)
  let questionText = "";
  let optionStartIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("- [")) {
      optionStartIndex = i;
      break;
    }
    if (line && !line.startsWith("**[⬆")) {
      questionText += (questionText ? " " : "") + line;
    }
  }
  
  if (!questionText || optionStartIndex === 0) {
    return null;
  }
  
  // Check for multi-select
  const multiMatch = questionText.match(/\((?:Choose|Select)\s+(\w+)\)/i);
  let selectCount = 1;
  let isMultiple = false;
  
  if (multiMatch) {
    isMultiple = true;
    const countWord = multiMatch[1].toLowerCase();
    const wordToNum: Record<string, number> = {
      "two": 2, "2": 2,
      "three": 3, "3": 3,
      "four": 4, "4": 4,
    };
    selectCount = wordToNum[countWord] || 2;
  }
  
  // Parse options
  const options: { id: string; text: string; isCorrect: boolean }[] = [];
  const correctAnswers: string[] = [];
  const optionIds = ["A", "B", "C", "D", "E", "F", "G", "H"];
  let optionIndex = 0;
  
  for (let i = optionStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match option format: - [ ] or - [x]
    const optionMatch = line.match(/^-\s*\[([ x])\]\s*(.+)$/i);
    if (optionMatch) {
      const isCorrect = optionMatch[1].toLowerCase() === "x";
      const text = optionMatch[2].trim();
      const id = optionIds[optionIndex];
      
      options.push({ id, text, isCorrect });
      
      if (isCorrect) {
        correctAnswers.push(id);
      }
      
      optionIndex++;
    }
    
    // Stop at back to top link or next question
    if (line.startsWith("**[⬆") || line.startsWith("###")) {
      break;
    }
  }
  
  if (options.length < 2 || correctAnswers.length === 0) {
    return null;
  }
  
  // Auto-detect multi-select if multiple correct answers
  if (correctAnswers.length > 1) {
    isMultiple = true;
    selectCount = correctAnswers.length;
  }
  
  return {
    questionText: questionText.replace(/\s+/g, " ").trim(),
    questionType: isMultiple ? "multiple" : "single",
    selectCount,
    options,
    correctAnswers,
  };
}

/**
 * Import questions for a certification
 */
async function importFromGitHub(source: typeof GITHUB_SOURCES[0], maxQuestions: number = 200): Promise<number> {
  console.log(`\n📜 ${source.certCode} - ${source.name}`);
  
  // Get certification from database
  const cert = await prisma.aWSCertification.findUnique({
    where: { code: source.certCode },
  });
  
  if (!cert) {
    console.log(`  ❌ Certification ${source.certCode} not found in database`);
    return 0;
  }
  
  // Get or create the PracticeExam
  let exam = await prisma.practiceExam.findFirst({
    where: { certificationCode: source.certCode },
  });
  
  if (!exam) {
    exam = await prisma.practiceExam.create({
      data: {
        slug: source.certCode.toLowerCase(),
        title: cert.name,
        shortTitle: source.certCode,
        certificationCode: source.certCode,
        description: `Practice exam for ${cert.name} with community-sourced questions.`,
        questionCount: cert.questionCount,
        timeLimit: cert.timeMinutes,
        passingScore: cert.passingPercentage,
        domains: cert.domains,
        difficulty: cert.level,
        isFree: cert.level === "foundational",
        requiredTier: cert.level === "foundational" ? "free" : "learner",
      },
    });
    console.log(`  📝 Created PracticeExam for ${source.certCode}`);
  }
  
  // Check if this cert already has diagnostic questions
  const existingDiagnosticCount = await prisma.examQuestion.count({
    where: {
      examId: exam.id,
      isDiagnostic: true,
    },
  });
  
  const needsDiagnostic = existingDiagnosticCount < 10;
  console.log(`  📊 Existing diagnostic questions: ${existingDiagnosticCount}`);
  if (needsDiagnostic) {
    console.log(`  🎯 Will mark first ${10 - existingDiagnosticCount} questions as diagnostic`);
  }
  
  // Fetch and parse markdown
  console.log(`  ⬇️  Fetching from GitHub...`);
  
  let markdown: string;
  try {
    markdown = await fetchMarkdown(source.url);
  } catch (err) {
    console.log(`  ❌ Failed to fetch: ${err}`);
    return 0;
  }
  
  const questions = parseMarkdownQuestions(markdown);
  console.log(`  📄 Parsed ${questions.length} questions from markdown`);
  
  // Get domains from certification
  const domains = cert.domains as Array<{ id: string; name: string; weight: number }>;
  
  // Import questions (limit to maxQuestions)
  let imported = 0;
  let diagnosticImported = existingDiagnosticCount;
  const questionsToImport = questions.slice(0, maxQuestions);
  
  for (let i = 0; i < questionsToImport.length; i++) {
    const q = questionsToImport[i];
    
    // Check if question already exists
    const existing = await prisma.examQuestion.findFirst({
      where: {
        examId: exam.id,
        questionText: { contains: q.questionText.substring(0, 80) },
      },
    });
    
    if (existing) {
      continue; // Skip duplicates
    }
    
    // Assign domain based on index (distribute evenly)
    const domainIndex = i % domains.length;
    const domain = domains[domainIndex];
    
    // Determine if this should be a diagnostic question
    const shouldBeDiagnostic = needsDiagnostic && diagnosticImported < 10;
    
    // Create the question
    await prisma.examQuestion.create({
      data: {
        examId: exam.id,
        questionText: q.questionText,
        questionType: q.questionType,
        selectCount: q.selectCount,
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: "Community-sourced question. See AWS documentation for detailed explanation.",
        domain: domain?.name || "General",
        domainId: domain?.id,
        difficulty: "medium",
        sourceType: "community",
        isDiagnostic: shouldBeDiagnostic,
        diagnosticOrder: shouldBeDiagnostic ? diagnosticImported + 1 : null,
        isVerified: false,
        awsServices: [],
        referenceLinks: [],
        tags: [source.certCode.toLowerCase(), cert.level, "community", "ditectrev"],
      },
    });
    
    if (shouldBeDiagnostic) {
      diagnosticImported++;
    }
    imported++;
  }
  
  console.log(`  ✅ Imported ${imported} new questions`);
  
  // Update exam total questions
  const totalQuestions = await prisma.examQuestion.count({
    where: { examId: exam.id },
  });
  
  await prisma.practiceExam.update({
    where: { id: exam.id },
    data: { totalQuestions },
  });
  
  console.log(`  📊 Total questions for ${source.certCode}: ${totalQuestions}`);
  
  return imported;
}

async function main() {
  console.log("📥 Importing AWS Questions from GitHub\n");
  console.log("Source: Ditectrev Open Source Question Banks");
  console.log("=" .repeat(50));
  
  let totalImported = 0;
  
  for (const source of GITHUB_SOURCES) {
    try {
      const imported = await importFromGitHub(source, 200); // Limit 200 per cert
      totalImported += imported;
    } catch (err) {
      console.log(`  ❌ Error: ${err}`);
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`✨ Import complete! ${totalImported} new questions imported.`);
  
  // Show summary
  const exams = await prisma.practiceExam.findMany({
    select: {
      certificationCode: true,
      totalQuestions: true,
    },
    orderBy: { certificationCode: "asc" },
  });
  
  console.log("\n📊 Question counts by certification:");
  for (const exam of exams) {
    console.log(`   ${exam.certificationCode}: ${exam.totalQuestions} questions`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
