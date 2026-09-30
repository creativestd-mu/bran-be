import { buildReviewCreateModal } from "../../../src/modules/review/review.slack";
import {
  REVIEW_CREATE_CONTEXT_BLOCK_ID,
  REVIEW_CREATE_FILE_BLOCK_ID,
  REVIEW_CREATE_USER_BLOCK_ID
} from "../../../src/modules/review/review.constants";

describe("review Slack modal", () => {
  it("marks required fields and keeps the file link optional", () => {
    const modal = buildReviewCreateModal({}) as {
      blocks: Array<{ block_id: string; label?: { text?: string }; optional?: boolean }>;
    };
    const byId = new Map(modal.blocks.map((block) => [block.block_id, block]));

    expect(byId.get(REVIEW_CREATE_USER_BLOCK_ID)?.label?.text).toContain("*");
    expect(byId.get(REVIEW_CREATE_CONTEXT_BLOCK_ID)?.label?.text).toContain("*");
    expect(byId.get(REVIEW_CREATE_FILE_BLOCK_ID)).toMatchObject({
      optional: true,
      label: { text: "File link (optional)" }
    });
  });
});
