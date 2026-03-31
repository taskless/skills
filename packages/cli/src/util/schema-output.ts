import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Print the --schema output for a command.
 * Outputs three labeled blocks: Input Schema, Output Schema, Error Schema.
 */
export function printSchema(schemas: {
  input?: ZodType;
  output: ZodType;
  error: ZodType;
}): void {
  console.log("Input Schema:");
  if (schemas.input) {
    console.log(JSON.stringify(zodToJsonSchema(schemas.input), null, 2));
  } else {
    console.log("This command does not accept JSON input.");
  }

  console.log("");
  console.log("Output Schema:");
  console.log(JSON.stringify(zodToJsonSchema(schemas.output), null, 2));

  console.log("");
  console.log("Error Schema:");
  console.log(JSON.stringify(zodToJsonSchema(schemas.error), null, 2));
}
