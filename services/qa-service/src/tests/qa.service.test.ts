import { describe, expect, it } from "vitest";
import { answerQuestion } from "../services/qa.service.js";

describe("answerQuestion", () => {
  it("should answer a question using repository context", async () => {
    const answer = await answerQuestion(
      "Where does the user login happen?",
      "metadata-test-20260913",
    );

    expect(answer).toBeTruthy();
    expect(typeof answer).toBe("string");
  });
});