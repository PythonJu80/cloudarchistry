/**
 * Diagram Components
 * 
 * AWS Architecture Diagram Builder for Cloud Academy challenges.
 */

export { DiagramCanvas } from "./diagram-canvas";
export type { DiagramData, DiagramNode, DiagramEdge, AuditResult } from "./diagram-canvas";
export { ServicePicker } from "./service-picker";
export { nodeTypes } from "./aws-nodes";
export { AwsTerminal } from "./aws-terminal";
export type { TerminalLine, AwsTerminalProps } from "./aws-terminal";
export { CLISimulator } from "./cli-simulator";
export type { CLISimulatorProps } from "./cli-simulator";
export { DeploymentPanel } from "./deployment-panel";

// Re-export generators for use in other components
export { generateAwsCliCommands } from "@/lib/aws-cli-generator";
export type { GeneratedCommand, GenerationResult, GeneratorOptions } from "@/lib/aws-cli-generator";
export { generateCloudFormation, templateToYaml } from "@/lib/cloudformation-generator";
export type { CloudFormationTemplate } from "@/lib/cloudformation-generator";
