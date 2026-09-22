import { z } from "zod";

export const FileExplanationSchema = z.object({
  filePath: z.string().min(1),

  fileRole: z.string().min(1),

  whyExists: z.string().min(1),

  responsibilities: z.array(
    z.string().min(1),
  ),

  keyFunctions: z.array(
  z.object({
    name: z.string().min(1),
    explanation: z.string().min(1),
    kind: z.string().optional(),
    startLine: z.number().int().nonnegative().optional(),
    endLine: z.number().int().nonnegative().optional(),
    code: z.string().optional(),
  }),
),

  dataFlow: z.string().min(1),

  usedBy: z.array(
    z.string().min(1),
  ),

  keyConcepts: z.array(
    z.object({
      name: z.string().min(1),
      explanation: z.string().min(1),
    }),
  ),

  uncertainty: z.array(
    z.string().min(1),
  ),
});

export type FileExplanation = z.infer<
  typeof FileExplanationSchema
>;