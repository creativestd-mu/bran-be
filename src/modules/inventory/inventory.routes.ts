import { Router } from "express";

import { param } from "../../utils/param";
import { requireAnyPermission, requirePermission } from "../auth/auth.guard";
import { authenticate } from "../auth/auth.middleware";
import {
  assignTeamsSchema,
  createInventoryItemSchema,
  listInventoryQuerySchema,
  listReservationsQuerySchema,
  returnReservationSchema,
  updateInventoryItemSchema
} from "./inventory.schemas";
import {
  assignTeamsToInventoryItem,
  createInventoryItemService,
  getInventoryItemById,
  getInventoryReservationById,
  listInventoryItems,
  listInventoryReservations,
  removeInventoryItem,
  returnInventoryReservation,
  updateInventoryItemService
} from "./inventory.service";

const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get("/", async (req, res, next) => {
  try {
    const query = listInventoryQuerySchema.parse(req.query);
    const result = await listInventoryItems(query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/reservations", async (req, res, next) => {
  try {
    const query = listReservationsQuerySchema.parse(req.query);
    const result = await listInventoryReservations(query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/reservations/:id", async (req, res, next) => {
  try {
    const result = await getInventoryReservationById(param(req.params.id));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post(
  "/reservations/:id/return",
  requireAnyPermission("manage_content", "manage_inventory"),
  async (req, res, next) => {
    try {
      const { notes } = returnReservationSchema.parse(req.body ?? {});
      const result = await returnInventoryReservation(param(req.params.id), notes);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

inventoryRouter.post("/", requirePermission("manage_inventory"), async (req, res, next) => {
  try {
    const payload = createInventoryItemSchema.parse(req.body);
    const item = await createInventoryItemService(payload);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getInventoryItemById(param(req.params.id));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.put("/:id", requirePermission("manage_inventory"), async (req, res, next) => {
  try {
    const payload = updateInventoryItemSchema.parse(req.body);
    const item = await updateInventoryItemService(param(req.params.id), payload);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.put(
  "/:id/teams",
  requirePermission("manage_inventory"),
  async (req, res, next) => {
    try {
      const { teamIds, primaryTeamId } = assignTeamsSchema.parse(req.body);
      const item = await assignTeamsToInventoryItem(param(req.params.id), teamIds, primaryTeamId);
      res.status(200).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
);

inventoryRouter.delete("/:id", requirePermission("manage_inventory"), async (req, res, next) => {
  try {
    await removeInventoryItem(param(req.params.id));
    res.status(200).json({ success: true, message: "Inventory item deleted" });
  } catch (error) {
    next(error);
  }
});

export { inventoryRouter };
