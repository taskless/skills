import { z } from "zod";

// --- Schema mode output (--schema --json) ---

export const schemaOutputSchema = z.object({
  astGrepSchema: z
    .record(z.string(), z.unknown())
    .describe("Official ast-grep rule JSON Schema"),
  tasklessRequirements: z
    .object({
      requiredFields: z
        .array(z.string())
        .describe("Fields Taskless requires beyond ast-grep defaults"),
      rules: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
        })
      ),
    })
    .describe("Taskless-specific validation rules"),
  examples: z
    .array(
      z.object({
        description: z.string(),
        rule: z.record(z.string(), z.unknown()),
      })
    )
    .describe("Curated annotated rule examples"),
});

// --- Verify mode output (rules verify <id> --json) ---

const layerResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).describe("Human-readable error messages"),
});

const testLayerResultSchema = layerResultSchema.extend({
  passed: z.number().describe("Number of test cases that passed"),
  failed: z.number().describe("Number of test cases that failed"),
});

export const verifyOutputSchema = z.object({
  success: z.boolean().describe("True if all layers passed"),
  ruleId: z.string(),
  schema: layerResultSchema.describe("Layer 1: Zod schema validation"),
  requirements: layerResultSchema.describe(
    "Layer 2: Taskless requirement checks"
  ),
  tests: testLayerResultSchema.describe("Layer 3: sg test execution"),
});

export const verifyErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().describe("Error message"),
});
