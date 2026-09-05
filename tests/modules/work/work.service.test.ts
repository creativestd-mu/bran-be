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

  it("blocks viewing other users units", () => {
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: true }, otherId)
    ).toThrow(HttpError);
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: false }, otherId)
    ).toThrow(HttpError);
  });

  it("allows owner to view their own unit", () => {
    expect(() =>
      assertCanView({ userId: ownerId, isPrivate: false }, ownerId)
    ).not.toThrow();
  });

  it("hides tasksPrivate member units from everyone except owner and superadmin", () => {
    expect(() =>
      assertCanView(
        { userId: ownerId, isPrivate: false, ownerTasksPrivate: true },
        otherId,
        "manager"
      )
    ).toThrow(HttpError);
    expect(() =>
      assertCanView(
        { userId: ownerId, isPrivate: false, ownerTasksPrivate: true },
        otherId,
        "admin"
      )
    ).toThrow(HttpError);
    expect(() =>
      assertCanView(
        { userId: ownerId, isPrivate: false, ownerTasksPrivate: true },
        otherId,
        "chief_of_staff"
      )
    ).toThrow(HttpError);
    expect(() =>
      assertCanView(
        { userId: ownerId, isPrivate: false, ownerTasksPrivate: true },
        otherId,
        "superadmin"
      )
    ).not.toThrow();
    expect(() =>
      assertCanView(
        { userId: ownerId, isPrivate: false, ownerTasksPrivate: true },
        ownerId,
        "content_creator"
      )
    ).not.toThrow();
  });
});
