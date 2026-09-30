import {
  createReview,
  respondToReviewRequest
} from "../../../src/modules/review/review.service";
import {
  createReviewRequest,
  findActiveUserById,
  findReviewById,
  respondToReview
} from "../../../src/modules/review/review.repository";
import {
  notifyPeerReviewRequested,
  notifyPeerReviewResponded
} from "../../../src/modules/notifications/notifications.service";

jest.mock("../../../src/modules/review/review.repository", () => ({
  createReviewRequest: jest.fn(),
  findActiveUserById: jest.fn(),
  findReviewById: jest.fn(),
  getReminderPreference: jest.fn(),
  listPendingIncoming: jest.fn(),
  listReviewsForUser: jest.fn(),
  listUsersNeedingReminder: jest.fn(),
  markReminderSent: jest.fn(),
  respondToReview: jest.fn(),
  setReviewSlackMessage: jest.fn(),
  upsertReminderPreference: jest.fn()
}));

jest.mock("../../../src/modules/notifications/notifications.service", () => ({
  notifyPeerReviewRequested: jest.fn(),
  notifyPeerReviewResponded: jest.fn()
}));

jest.mock("../../../src/modules/review/review.slack", () => ({
  isSlackUserTheReviewer: jest.fn(),
  notifyReviewerOnSlack: jest.fn().mockResolvedValue(null),
  openReviewResponseModal: jest.fn(),
  resolveBranUserForReviewQuery: jest.fn(),
  sendPendingReviewsReminderDm: jest.fn(),
  updateReviewSlackCard: jest.fn()
}));

jest.mock("../../../src/modules/attendance/attendance.slack", () => ({
  lookupSlackUserByEmail: jest.fn().mockResolvedValue(null),
  sendDm: jest.fn()
}));

jest.mock("../../../src/lib/file-storage", () => ({
  openStoredFileReadStream: jest.fn(),
  saveStoredFile: jest.fn()
}));

const createReviewRequestMock = createReviewRequest as jest.MockedFunction<
  typeof createReviewRequest
>;
const findActiveUserByIdMock = findActiveUserById as jest.MockedFunction<
  typeof findActiveUserById
>;
const findReviewByIdMock = findReviewById as jest.MockedFunction<typeof findReviewById>;
const respondToReviewMock = respondToReview as jest.MockedFunction<typeof respondToReview>;
const notifyPeerReviewRequestedMock = notifyPeerReviewRequested as jest.MockedFunction<
  typeof notifyPeerReviewRequested
>;
const notifyPeerReviewRespondedMock = notifyPeerReviewResponded as jest.MockedFunction<
  typeof notifyPeerReviewResponded
>;

const now = new Date("2026-09-30T12:00:00.000Z");
const requester = {
  id: "requester-1",
  name: "Requester",
  email: "requester@example.com",
  avatarUrl: null
};
const reviewer = {
  id: "reviewer-1",
  name: "Reviewer",
  email: "reviewer@example.com",
  avatarUrl: null
};

function review(status: "pending" | "accepted" | "rejected" = "pending") {
  return {
    id: "review-1",
    requestedById: requester.id,
    requestedToId: reviewer.id,
    context: "Please review the launch document",
    fileUrl: "https://example.com/document",
    storagePath: null,
    fileName: null,
    contentType: null,
    status,
    responseComment: status === "pending" ? null : "Looks good",
    respondedAt: status === "pending" ? null : now,
    slackChannelId: null,
    slackMessageTs: null,
    reviewerSlackUserId: null,
    createdAt: now,
    updatedAt: now,
    requestedBy: requester,
    requestedTo: reviewer
  };
}

describe("review notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an in-app notification for a new review request", async () => {
    findActiveUserByIdMock.mockResolvedValue(reviewer);
    createReviewRequestMock.mockResolvedValue(review());

    await createReview(requester.id, {
      requestedToId: reviewer.id,
      context: "Please review the launch document",
      fileUrl: "https://example.com/document"
    });

    expect(notifyPeerReviewRequestedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: "review-1",
        requestedToId: reviewer.id,
        requestedBy: { id: requester.id, name: requester.name }
      })
    );
  });

  it("notifies the requester with the final review status", async () => {
    findReviewByIdMock.mockResolvedValue(review());
    respondToReviewMock.mockResolvedValue(review("accepted"));

    await respondToReviewRequest(reviewer.id, "review-1", {
      decision: "accepted",
      comment: "Looks good"
    });

    expect(notifyPeerReviewRespondedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewId: "review-1",
        requestedById: requester.id,
        status: "accepted",
        responseComment: "Looks good"
      })
    );
  });
});
