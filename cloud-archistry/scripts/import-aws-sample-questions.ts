/**
 * Import AWS Official Sample Questions from PDFs
 * 
 * This script:
 * 1. Downloads official AWS sample question PDFs
 * 2. Parses questions, options, and answers
 * 3. Imports them as diagnostic questions in the database
 * 
 * Run with: npx ts-node scripts/import-aws-sample-questions.ts
 * 
 * Prerequisites:
 * - npm install pdf-parse
 * - Run seed-certifications.ts first
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const prisma = new PrismaClient();

// Directory to store downloaded PDFs
const PDF_DIR = path.join(__dirname, "../.pdf-cache");

// Ensure PDF cache directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

/**
 * Download a PDF from URL
 */
async function downloadPdf(url: string, filename: string): Promise<string> {
  const filepath = path.join(PDF_DIR, filename);
  
  // Skip if already downloaded
  if (fs.existsSync(filepath)) {
    console.log(`  📁 Using cached: ${filename}`);
    return filepath;
  }
  
  console.log(`  ⬇️  Downloading: ${filename}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://aws.amazon.com/',
      }
    };
    
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      ...options
    };
    
    https.get(reqOptions, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(filepath);
          downloadPdf(redirectUrl, filename).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(filepath);
      });
    }).on("error", (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(err);
    });
  });
}

/**
 * Parse PDF text to extract questions
 * This is a simplified parser - AWS PDFs have a consistent format
 */
interface ParsedQuestion {
  questionNumber: number;
  questionText: string;
  questionType: "single" | "multiple";
  selectCount: number;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation: string;
  domain?: string;
}

async function parsePdfQuestions(filepath: string): Promise<ParsedQuestion[]> {
  // Dynamic import for pdf-parse (CommonJS module)
  const pdfParse = (await import("pdf-parse")).default;
  
  const dataBuffer = fs.readFileSync(filepath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;
  
  const questions: ParsedQuestion[] = [];
  
  // Split by question numbers (1), 2), 3), etc. or 1. 2. 3.
  const questionPattern = /(?:^|\n)\s*(\d+)[.)]\s+/g;
  const parts = text.split(questionPattern);
  
  // Process each question
  for (let i = 1; i < parts.length; i += 2) {
    const questionNum = parseInt(parts[i]);
    const content = parts[i + 1];
    
    if (!content) continue;
    
    try {
      const parsed = parseQuestionContent(content, questionNum);
      if (parsed) {
        questions.push(parsed);
      }
    } catch (err) {
      console.log(`    ⚠️  Could not parse question ${questionNum}`);
    }
  }
  
  return questions;
}

/**
 * Parse individual question content
 */
function parseQuestionContent(content: string, questionNum: number): ParsedQuestion | null {
  // Check for multi-select indicator
  const multiSelectMatch = content.match(/\((?:Select|Choose)\s+(\w+)\)/i);
  const isMultiple = !!multiSelectMatch;
  let selectCount = 1;
  
  if (multiSelectMatch) {
    const countWord = multiSelectMatch[1].toLowerCase();
    const wordToNum: Record<string, number> = {
      "two": 2, "2": 2,
      "three": 3, "3": 3,
      "four": 4, "4": 4,
    };
    selectCount = wordToNum[countWord] || 2;
  }
  
  // Extract options (A., B., C., D., E.)
  const optionPattern = /([A-E])[.)]\s+([\s\S]*?)(?=(?:[A-E][.)]\s)|(?:Answer|Correct|Explanation|$))/gi;
  const options: { id: string; text: string }[] = [];
  let match;
  
  while ((match = optionPattern.exec(content)) !== null) {
    options.push({
      id: match[1].toUpperCase(),
      text: match[2].trim().replace(/\s+/g, " "),
    });
  }
  
  if (options.length < 2) {
    return null; // Not a valid question
  }
  
  // Extract question text (everything before first option)
  const firstOptionIndex = content.search(/[A-E][.)]\s+/i);
  let questionText = firstOptionIndex > 0 
    ? content.substring(0, firstOptionIndex).trim()
    : "";
  
  // Clean up question text
  questionText = questionText
    .replace(/\s+/g, " ")
    .replace(/\(Select \w+\)/gi, "")
    .trim();
  
  if (!questionText || questionText.length < 20) {
    return null;
  }
  
  // Extract answer(s)
  const answerPattern = /(?:Answer|Correct)[:\s]+([A-E](?:\s*,\s*[A-E])*)/i;
  const answerMatch = content.match(answerPattern);
  const correctAnswers = answerMatch 
    ? answerMatch[1].split(/\s*,\s*/).map(a => a.trim().toUpperCase())
    : [];
  
  // Extract explanation
  const explanationPattern = /(?:Explanation|Rationale)[:\s]+([\s\S]*?)(?=(?:\d+[.)]\s)|$)/i;
  const explanationMatch = content.match(explanationPattern);
  const explanation = explanationMatch 
    ? explanationMatch[1].trim().replace(/\s+/g, " ")
    : "See AWS documentation for detailed explanation.";
  
  return {
    questionNumber: questionNum,
    questionText,
    questionType: isMultiple ? "multiple" : "single",
    selectCount,
    options,
    correctAnswers,
    explanation,
  };
}

/**
 * Import questions for a certification
 */
async function importCertificationQuestions(certCode: string): Promise<number> {
  // Get certification from database
  const cert = await prisma.aWSCertification.findUnique({
    where: { code: certCode },
  });
  
  if (!cert) {
    console.log(`  ❌ Certification ${certCode} not found in database`);
    return 0;
  }
  
  if (!cert.sampleQuestionsUrl) {
    console.log(`  ❌ No sample questions URL for ${certCode}`);
    return 0;
  }
  
  // Get or create the PracticeExam for this certification
  let exam = await prisma.practiceExam.findFirst({
    where: { certificationCode: certCode },
  });
  
  if (!exam) {
    // Create the practice exam
    exam = await prisma.practiceExam.create({
      data: {
        slug: certCode.toLowerCase(),
        title: cert.name,
        shortTitle: certCode,
        certificationCode: certCode,
        description: `Official AWS ${cert.shortName} practice exam with diagnostic and adaptive questions.`,
        questionCount: cert.questionCount,
        timeLimit: cert.timeMinutes,
        passingScore: cert.passingPercentage,
        domains: cert.domains,
        difficulty: cert.level,
        isFree: cert.level === "foundational",
        requiredTier: cert.level === "foundational" ? "free" : "learner",
        icon: getIconForCategory(cert.category),
        color: getColorForLevel(cert.level),
      },
    });
    console.log(`  📝 Created PracticeExam for ${certCode}`);
  }
  
  // Download and parse PDF
  const filename = `${certCode}-sample-questions.pdf`;
  
  try {
    const filepath = await downloadPdf(cert.sampleQuestionsUrl, filename);
    const questions = await parsePdfQuestions(filepath);
    
    console.log(`  📄 Parsed ${questions.length} questions from PDF`);
    
    // Get domains from certification
    const domains = cert.domains as Array<{ id: string; name: string; weight: number }>;
    
    // Import questions
    let imported = 0;
    const questionIds: string[] = [];
    
    for (const q of questions) {
      // Assign domain based on question number (distribute evenly)
      const domainIndex = (q.questionNumber - 1) % domains.length;
      const domain = domains[domainIndex];
      
      // Check if question already exists (by text similarity)
      const existing = await prisma.examQuestion.findFirst({
        where: {
          examId: exam.id,
          questionText: { contains: q.questionText.substring(0, 100) },
        },
      });
      
      if (existing) {
        console.log(`    ⏭️  Question ${q.questionNumber} already exists`);
        questionIds.push(existing.id);
        continue;
      }
      
      // Create the question
      const question = await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          questionText: q.questionText,
          questionType: q.questionType,
          selectCount: q.selectCount,
          options: q.options.map(o => ({ ...o, isCorrect: q.correctAnswers.includes(o.id) })),
          correctAnswers: q.correctAnswers,
          explanation: q.explanation,
          domain: domain?.name || "General",
          domainId: domain?.id,
          difficulty: "medium",
          sourceType: "official_pdf",
          isDiagnostic: true,
          diagnosticOrder: q.questionNumber,
          isVerified: true, // Official AWS questions are pre-verified
          verifiedAt: new Date(),
          awsServices: [],
          referenceLinks: [{ title: "AWS Documentation", url: cert.awsPageUrl || "" }],
          tags: [certCode.toLowerCase(), cert.level, "official"],
        },
      });
      
      questionIds.push(question.id);
      imported++;
      console.log(`    ✅ Imported question ${q.questionNumber}`);
    }
    
    // Create or update DiagnosticQuestionSet
    const domainCoverage: Record<string, number> = {};
    for (const q of questions) {
      const domainIndex = (q.questionNumber - 1) % domains.length;
      const domainName = domains[domainIndex]?.name || "General";
      domainCoverage[domainName] = (domainCoverage[domainName] || 0) + 1;
    }
    
    await prisma.diagnosticQuestionSet.upsert({
      where: {
        id: `${cert.id}-official`,
      },
      update: {
        questionIds,
        questionCount: questionIds.length,
        domainCoverage,
        importedAt: new Date(),
      },
      create: {
        id: `${cert.id}-official`,
        certificationId: cert.id,
        name: "Official AWS Sample Questions",
        description: `Official sample questions from AWS for the ${cert.name} exam.`,
        sourceUrl: cert.sampleQuestionsUrl,
        sourceName: "AWS Official",
        questionIds,
        questionCount: questionIds.length,
        domainCoverage,
        isPrimary: true,
        importedAt: new Date(),
      },
    });
    
    // Update exam total questions
    await prisma.practiceExam.update({
      where: { id: exam.id },
      data: { totalQuestions: questionIds.length },
    });
    
    return imported;
  } catch (err) {
    console.log(`  ❌ Error processing ${certCode}:`, err);
    return 0;
  }
}

function getIconForCategory(category: string | null): string {
  const icons: Record<string, string> = {
    "Cloud": "☁️",
    "Architect": "🏗️",
    "Developer": "💻",
    "Operations": "⚙️",
    "Data": "📊",
    "Security": "🔐",
    "AI/ML": "🤖",
    "Networking": "🌐",
    "SAP": "🏢",
  };
  return icons[category || ""] || "📝";
}

function getColorForLevel(level: string): string {
  const colors: Record<string, string> = {
    "foundational": "#3B82F6",  // Blue
    "associate": "#FF9900",     // AWS Orange
    "professional": "#8B5CF6",  // Purple
    "specialty": "#EF4444",     // Red
  };
  return colors[level] || "#FF9900";
}

async function main() {
  console.log("📥 Importing AWS Official Sample Questions\n");
  console.log("=" .repeat(50));
  
  // Get all active certifications
  const certifications = await prisma.aWSCertification.findMany({
    where: { isActive: true },
    orderBy: [
      { level: "asc" },
      { code: "asc" },
    ],
  });
  
  if (certifications.length === 0) {
    console.log("❌ No certifications found. Run seed-certifications.ts first!");
    return;
  }
  
  console.log(`Found ${certifications.length} certifications\n`);
  
  let totalImported = 0;
  
  for (const cert of certifications) {
    console.log(`\n📜 ${cert.code} - ${cert.shortName}`);
    const imported = await importCertificationQuestions(cert.code);
    totalImported += imported;
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`✨ Import complete! ${totalImported} questions imported.`);
  console.log("\nNext steps:");
  console.log("  1. Review imported questions in the database");
  console.log("  2. Run the adaptive question generator to add more questions");
  console.log("  3. Test the diagnostic flow in the UI");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
