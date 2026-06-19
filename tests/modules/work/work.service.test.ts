import {
  assertCanModify,
  assertCanView
} from "../../../src/modules/work/work.service";
import { HttpError } from "../../../src/utils/httpError";

describe("work unit closed lock helpers", () => {
  const ownerId = "owner-1";
  const otherId = "other-1";

  it("allows owner to modify their own unit", () => {
    expect(() =>
      assertCanModify({ userId: ownerId, isPrivate: false }, ownerId, "content_creator")
    ).not.toThrow();
  });

  it("blocks non-owner without elevated role", () => {
    expect(() =>
      assertCanModify({ userId: ownerId, isPrivate: false }, otherId, "content_creator")
    ).toThrow(HttpError);
  });

  it("blocks viewing private units for other users", () => {
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: true }, otherId, "content_creator")
    ).toThrow(HttpError);
  });

  it("blocks viewing other users public units without elevated role", () => {
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: false }, otherId, "content_creator")
    ).toThrow(HttpError);
  });

  it("allows admin to view other users public units", () => {
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: false }, otherId, "admin")
    ).not.toThrow();
  });
});
