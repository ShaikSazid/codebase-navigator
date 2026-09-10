import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../src/app.js";

describe("GET /api/health", () => {
    it("should return status Ok", async () => {
        const response = await request(app)
        .get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "Ok" });
    })
});