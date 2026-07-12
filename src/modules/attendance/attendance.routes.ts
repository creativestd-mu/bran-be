import { Router } from "express";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  attendanceCheckBodySchema,
  attendanceDateQuerySchema,
  attendanceRemindBodySchema,
  listPersonStatsQuerySchema,
  updateMemberPodSchema,
  updatePersonStatsActionSchema
} from "./attendance.schemas";
import {
  assertCanManageAttendance,
  getAttendancePersonStats,
  listAttendancePersonStats,
  listTodayAttendance,
  rebuildAllAttendancePersonStats,
  runEtaCheck,
  sendRemindersForDate,
  setAttendancePersonAction,
  updateMemberPod
} from "./attendance.service";
import { todayInIST } from "./attendance.dates";
import { listActiveSlackMembers } from "./attendance.repository";

const attendanceRouter = Router();

attendanceRouter.use(authenticate);
attendanceRouter.use((req, _res, next) => {
  try {
    assertCanManageAttendance(req.user!.roleName);
    next();
  } catch (error) {
    next(error);
  }
});

/** GET /attendance — today's (or ?date=) entries for the UI */
attendanceRouter.get("/", async (req, res, next) => {
  try {
    const query = attendanceDateQuerySchema.parse(req.query);
    const data = await listTodayAttendance(query.date ?? todayInIST());
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /attendance/check — manual Run Check */
attendanceRouter.post("/check", async (req, res, next) => {
  try {
    const body = attendanceCheckBodySchema.parse(req.body ?? {});
    const result = await runEtaCheck(body.date ?? todayInIST(), {
      sendReminders: body.sendReminders
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /attendance/remind — Send Reminders */
attendanceRouter.post("/remind", async (req, res, next) => {
  try {
    const body = attendanceRemindBodySchema.parse(req.body ?? {});
    const result = await sendRemindersForDate(body.date ?? todayInIST());
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** GET /attendance/stats — per-person rolling counters for action */
attendanceRouter.get("/stats", async (req, res, next) => {
  try {
    const query = listPersonStatsQuerySchema.parse(req.query);
    const data = await listAttendancePersonStats(query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /attendance/stats/rebuild — recompute all person stats from eta_entries */
attendanceRouter.post("/stats/rebuild", async (req, res, next) => {
  try {
    const data = await rebuildAllAttendancePersonStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** GET /attendance/stats/:slackUserId */
attendanceRouter.get("/stats/:slackUserId", async (req, res, next) => {
  try {
    const data = await getAttendancePersonStats(param(req.params.slackUserId));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** PATCH /attendance/stats/:slackUserId/action — flag / warn / resolve */
attendanceRouter.patch("/stats/:slackUserId/action", async (req, res, next) => {
  try {
    const body = updatePersonStatsActionSchema.parse(req.body);
    const data = await setAttendancePersonAction({
      slackUserId: param(req.params.slackUserId),
      actionStatus: body.actionStatus,
      actionNote: body.actionNote,
      actionTakenById: req.user!.userId
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** GET /attendance/members — synced Slack channel members */
attendanceRouter.get("/members", async (req, res, next) => {
  try {
    const members = await listActiveSlackMembers();
    res.status(200).json({
      success: true,
      data: members.map((m) => ({
        slackUserId: m.slackUserId,
        name: m.name,
        email: m.email,
        realName: m.realName,
        pod: m.pod,
        syncedAt: m.syncedAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    next(error);
  }
});

/** PATCH /attendance/members/:slackUserId/pod — set production exemption */
attendanceRouter.patch("/members/:slackUserId/pod", async (req, res, next) => {
  try {
    const body = updateMemberPodSchema.parse(req.body);
    const member = await updateMemberPod(param(req.params.slackUserId), body.pod);
    res.status(200).json({
      success: true,
      data: {
        slackUserId: member.slackUserId,
        pod: member.pod
      }
    });
  } catch (error) {
    next(error);
  }
});

export { attendanceRouter };
