import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  getVerticalById,
  listVerticals,
  updateVertical
} from "./verticals.repository";

const SUPERADMIN_ROLE_NAME = "superadmin";

export async function listAllVerticals() {
  return listVerticals();
}

export async function getVertical(id: string) {
  const vertical = await getVerticalById(id);
  if (!vertical) throw new HttpError(404, "Vertical not found");
  return vertical;
}

export async function updateVerticalDetails(
  id: string,
  input: { name?: string; description?: string | null }
) {
  await getVertical(id);
  return updateVertical(id, input);
}

/**
 * Reassign the owner of a vertical. The new owner MUST be a user with the
 * `superadmin` role; only callers holding `manage_verticals` (which the
 * superadmin role grants) can invoke this path via the route guard.
 */
export async function changeVerticalOwner(verticalId: string, newOwnerUserId: string) {
  await getVertical(verticalId);

  const newOwner = await prisma.user.findUnique({
    where: { id: newOwnerUserId },
    include: { role: true }
  });

  if (!newOwner) throw new HttpError(404, "New owner user not found");
  if (!newOwner.isActive) {
    throw new HttpError(400, "New owner user is not active");
  }
  if (newOwner.role?.name !== SUPERADMIN_ROLE_NAME) {
    throw new HttpError(
      400,
      "Vertical owner must be a user with the superadmin role"
    );
  }

  return updateVertical(verticalId, { ownerUserId: newOwnerUserId });
}
