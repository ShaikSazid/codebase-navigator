import { z } from "zod";

const LayerGroupSchema = z.object({
  name: z.string(),
  description: z.string(),
  files: z.array(z.string()),
});

const RankedFileSchema = z.object({
  path: z.string(),
  importanceScore: z.number().min(0).max(1),
  reason: z.string(),
});

export const ArchitectureMapSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("structured"),
    layers: z.array(LayerGroupSchema),
    summary: z.string(),
  }),

  z.object({
    type: z.literal("importance-ranked"),
    rankedFiles: z.array(RankedFileSchema),
    summary: z.string(),
  }),
]);