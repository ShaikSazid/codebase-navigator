import { z } from "zod";

export const createRepositorySchema = z.object({
    url: z.string().url("A valid URL is required").refine(
        (url) => url.startsWith("https://github.com/"),
        "Only GitHub repository URLs are supported"
    ),
});

export type createRepositoryInput = z.infer<typeof createRepositorySchema>;