const mockFindMany = jest.fn();
const mockDeleteMany = jest.fn();
const mockCreateMany = jest.fn();

jest.mock("../../../src/lib/prisma", () => ({
  prisma: {
    pendingReply: { findMany: mockFindMany },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback({ pendingReply: { deleteMany: mockDeleteMany, createMany: mockCreateMany } })
    )
  }
}));

import {
  listPendingRepliesForUser,
  replacePendingRepliesForUser
} from "../../../src/modules/pending-replies/pending-replies.repository";

describe("pending reply repository privacy boundary", () => {
  beforeEach(() => {
    mockFindMany.mockResolvedValue([]);
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  it("always constrains reads to the requesting user", async () => {
    const since = new Date("2026-09-16T00:00:00.000Z");
    await listPendingRepliesForUser("user-a", 10, since);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-a", lastMessageAt: { gte: since } },
        orderBy: [{ lastMessageAt: "desc" }, { id: "asc" }]
      })
    );
  });

  it("replaces only one user's rows for the selected source", async () => {
    await replacePendingRepliesForUser("user-a", "SLACK", []);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-a", source: "SLACK" } });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });
});
