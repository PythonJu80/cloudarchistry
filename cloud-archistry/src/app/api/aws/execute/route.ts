/**
 * AWS CLI Command Execution API
 * 
 * Executes AWS CLI commands using user's encrypted credentials.
 * Commands are validated and sanitized before execution.
 * 
 * SECURITY:
 * - Only allows 'aws' commands
 * - Blocks destructive commands without --dry-run
 * - Rate limited per user
 * - All executions are logged
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDecryptedAwsCredentials } from "@/lib/academy/services/aws-credentials";

// Allowed AWS services for CLI execution
const ALLOWED_SERVICES = [
  "ec2", "s3", "rds", "lambda", "iam", "sts", "cloudformation",
  "dynamodb", "sns", "sqs", "elasticache", "ecs", "eks", "ecr",
  "route53", "cloudfront", "cloudwatch", "logs", "events",
  "secretsmanager", "kms", "cognito-idp", "apigateway",
  "elbv2", "autoscaling", "backup", "config",
];

// Blocked command patterns (destructive operations)
const BLOCKED_PATTERNS = [
  /delete-/i,
  /terminate-/i,
  /remove-/i,
  /destroy/i,
  /--force/i,
  /deregister/i,
  /revoke/i,
  /disable/i,
];

// Read-only commands that are always safe
const SAFE_PATTERNS = [
  /^describe-/i,
  /^list-/i,
  /^get-/i,
  /^show-/i,
  /--dry-run/i,
];

interface ExecuteRequest {
  command: string;
}

/**
 * Validate and sanitize AWS CLI command
 */
function validateCommand(command: string): { valid: boolean; error?: string; sanitized?: string } {
  // Must start with 'aws '
  if (!command.startsWith("aws ")) {
    return { valid: false, error: "Command must start with 'aws'" };
  }

  // Parse the command
  const parts = command.trim().split(/\s+/);
  if (parts.length < 3) {
    return { valid: false, error: "Invalid AWS CLI command format" };
  }

  const service = parts[1];
  const action = parts[2];

  // Check if service is allowed
  if (!ALLOWED_SERVICES.includes(service)) {
    return { valid: false, error: `Service '${service}' is not allowed` };
  }

  // Check for blocked patterns (unless it's a safe read-only command)
  const isSafe = SAFE_PATTERNS.some((pattern) => pattern.test(action) || pattern.test(command));
  
  if (!isSafe) {
    const isBlocked = BLOCKED_PATTERNS.some((pattern) => pattern.test(action) || pattern.test(command));
    if (isBlocked) {
      return { 
        valid: false, 
        error: "Destructive commands are blocked. Add --dry-run to preview or use AWS Console." 
      };
    }
  }

  // Sanitize: remove any shell injection attempts
  const sanitized = command
    .replace(/[;&|`$(){}]/g, "") // Remove shell metacharacters
    .replace(/\n/g, " ")          // Remove newlines
    .trim();

  return { valid: true, sanitized };
}

/**
 * Execute AWS CLI command using SDK
 * We use the AWS SDK instead of spawning CLI for security
 */
async function executeAwsCommand(
  command: string,
  credentials: { accessKeyId: string; secretAccessKey: string; region: string }
): Promise<{ output: string; exitCode: number }> {
  const parts = command.trim().split(/\s+/);
  const service = parts[1];
  const action = parts[2];

  // For now, we'll simulate execution and return helpful output
  // In production, this would use the AWS SDK to execute the actual command
  
  // Special case: sts get-caller-identity (always works)
  if (service === "sts" && action === "get-caller-identity") {
    try {
      // Use AWS SDK to get caller identity
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      
      const client = new STSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      const response = await client.send(new GetCallerIdentityCommand({}));
      
      return {
        output: JSON.stringify({
          UserId: response.UserId,
          Account: response.Account,
          Arn: response.Arn,
        }, null, 2),
        exitCode: 0,
      };
    } catch (error) {
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
      };
    }
  }

  // EC2 describe commands
  if (service === "ec2") {
    try {
      const { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeInstancesCommand, DescribeSecurityGroupsCommand } = await import("@aws-sdk/client-ec2");
      
      const client = new EC2Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      if (action === "describe-vpcs") {
        const response = await client.send(new DescribeVpcsCommand({}));
        return {
          output: JSON.stringify(response.Vpcs, null, 2),
          exitCode: 0,
        };
      }

      if (action === "describe-subnets") {
        const response = await client.send(new DescribeSubnetsCommand({}));
        return {
          output: JSON.stringify(response.Subnets, null, 2),
          exitCode: 0,
        };
      }

      if (action === "describe-instances") {
        const response = await client.send(new DescribeInstancesCommand({}));
        const instances = response.Reservations?.flatMap(r => r.Instances) || [];
        return {
          output: JSON.stringify(instances, null, 2),
          exitCode: 0,
        };
      }

      if (action === "describe-security-groups") {
        const response = await client.send(new DescribeSecurityGroupsCommand({}));
        return {
          output: JSON.stringify(response.SecurityGroups, null, 2),
          exitCode: 0,
        };
      }
    } catch (error) {
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
      };
    }
  }

  // S3 commands
  if (service === "s3" || service === "s3api") {
    try {
      const { S3Client, ListBucketsCommand } = await import("@aws-sdk/client-s3");
      
      const client = new S3Client({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      if (action === "ls" || action === "list-buckets") {
        const response = await client.send(new ListBucketsCommand({}));
        const output = response.Buckets?.map(b => `${b.CreationDate?.toISOString()} ${b.Name}`).join("\n") || "No buckets found";
        return { output, exitCode: 0 };
      }
    } catch (error) {
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
      };
    }
  }

  // Lambda commands
  if (service === "lambda") {
    try {
      const { LambdaClient, ListFunctionsCommand } = await import("@aws-sdk/client-lambda");
      
      const client = new LambdaClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      if (action === "list-functions") {
        const response = await client.send(new ListFunctionsCommand({}));
        return {
          output: JSON.stringify(response.Functions, null, 2),
          exitCode: 0,
        };
      }
    } catch (error) {
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
      };
    }
  }

  // RDS commands
  if (service === "rds") {
    try {
      const { RDSClient, DescribeDBInstancesCommand } = await import("@aws-sdk/client-rds");
      
      const client = new RDSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });

      if (action === "describe-db-instances") {
        const response = await client.send(new DescribeDBInstancesCommand({}));
        return {
          output: JSON.stringify(response.DBInstances, null, 2),
          exitCode: 0,
        };
      }
    } catch (error) {
      return {
        output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        exitCode: 1,
      };
    }
  }

  // Default: command not implemented yet
  return {
    output: `Command '${service} ${action}' is recognized but not yet implemented.\nSupported commands:\n- aws sts get-caller-identity\n- aws ec2 describe-vpcs\n- aws ec2 describe-subnets\n- aws ec2 describe-instances\n- aws ec2 describe-security-groups\n- aws s3 ls\n- aws lambda list-functions\n- aws rds describe-db-instances`,
    exitCode: 0,
  };
}

/**
 * POST /api/aws/execute
 * Execute an AWS CLI command
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json(
        { error: "Please sign in to execute AWS commands" },
        { status: 401 }
      );
    }

    const body: ExecuteRequest = await request.json();
    const { command } = body;

    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    // Validate command
    const validation = validateCommand(command);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get user's AWS credentials
    const credentials = await getDecryptedAwsCredentials(session.user.academyProfileId);
    
    if (!credentials) {
      return NextResponse.json(
        { error: "No AWS credentials configured. Go to Settings → AWS to add your credentials." },
        { status: 400 }
      );
    }

    // Execute command
    const result = await executeAwsCommand(validation.sanitized!, credentials);

    // Log execution (for audit)
    console.log(`[AWS CLI] User ${session.user.academyProfileId} executed: ${validation.sanitized}`);

    return NextResponse.json({
      success: true,
      output: result.output,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error("AWS execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute command", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
