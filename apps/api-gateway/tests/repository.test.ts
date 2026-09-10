import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";

describe("POST /api/repositories", () => {
    it("should accept a valid GitHub repository URL", async () => {
        const response = await request(app)
            .post("/api/repositories")
            .send({
                url: "https://github.com/facebook/react",
            });

        expect(response.status).toBe(201);

        expect(response.body.message).toBe("Repository analysis started");
        expect(response.body.url).toBe(
            "https://github.com/facebook/react"
        );
        expect(response.body.jobId).toEqual(expect.any(String));
    });

    it("should reject an invalid URL", async () => {
        const response = await request(app)
            .post("/api/repositories")
            .send({
                url: "not-a-url",
            });

        expect(response.status).toBe(400);
    });

    it("should reject a non-GitHub URL", async () => {
        const response = await request(app)
            .post("/api/repositories")
            .send({
                url: "https://example.com/my-repository",
            });

        expect(response.status).toBe(400);
    });

    it("should reject a request without a URL", async () => {
        const response = await request(app)
            .post("/api/repositories")
            .send({});

        expect(response.status).toBe(400);
    });

    describe("GET /api/repositories/:jobId", () => {
        it("should return the repository analysis job", async () => {
            const createResponse = await request(app)
                .post("/api/repositories")
                .send({
                    url: "https://github.com/facebook/react",
                });

            const { jobId } = createResponse.body;

            const response = await request(app)
                .get(`/api/repositories/${jobId}`);

            expect(response.status).toBe(200);

            expect(response.body).toEqual({
                jobId,
                url: "https://github.com/facebook/react",
                status: "queued",
            });
        });

        it("should return 404 for an unknown job", async () => {
            const response = await request(app)
                .get("/api/repositories/unknown-job-id");

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                message: "Repository analysis job not found",
            });
        });
    });
});