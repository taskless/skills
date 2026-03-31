import { z } from "zod";
import type { z as zType } from "zod";

/**
 * Print the --schema output for a command.
 * Outputs three labeled blocks: Input Schema, Output Schema, Error Schema.
 */
export function printSchema(schemas: {
  input?: zType.ZodType;
  output: zType.ZodType;
  error: zType.ZodType;
}): void {
  console.log("Input Schema:");
  if (schemas.input) {
    console.log(JSON.stringify(z.toJSONSchema(schemas.input), null, 2));
  } else {
    console.log("This command does not accept JSON input.");
  }

  console.log("");
  console.log("Output Schema:");
  console.log(JSON.stringify(z.toJSONSchema(schemas.output), null, 2));

  console.log("");
  console.log("Error Schema:");
  console.log(JSON.stringify(z.toJSONSchema(schemas.error), null, 2));
}
