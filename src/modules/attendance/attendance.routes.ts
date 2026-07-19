import { Router } from "express";

import { param } from "../../utils/param";
import { authenticate } from "../auth/auth.middleware";
import {
  attendanceCheckBodySchema,
  attendanceDateQuerySchema,
  attendanceRemindBodySchema,
  listPersonStatsQuerySchema,
  setPersonStatsCountsSchema,
  updateAttendancePolicySchema,
  updateMemberPodSchema,
  updatePersonStatsActionSchema,
  userDetailQuerySchema
} from "./attendance.schemas";
import {
  assertCanManageAttendance,
  getAttendancePersonStats,
  getAttendanceUserDetail,
  listAttendancePersonStats,
  listTodayAttendance,
  rebuildAllAttendancePersonStats,
  resetAttendancePersonCounts,
  runEtaCheck,
  sendReminderForUser,
  sendRemindersForDate,
  setAttendancePersonAction,
  setAttendancePersonCounts,
  updateMemberPod
} from "./attendance.service";
import { getAttendancePolicy, updateAttendancePolicy } from "./attendance.policy";
import { todayInIST } from "./attendance.dates";
import { listActiveSlackMembers } from "./attendance.repository";
import { escalationRouter } from "../escalation/escalation.routes";

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

/** GET /attendance — today's (or ?date=&filter=) entries for the UI */
attendanceRouter.get("/", async (req, res, next) => {
  try {
    const query = attendanceDateQuerySchema.parse(req.query);
    const data = await listTodayAttendance(query.date ?? todayInIST(), query.filter);
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
    const date = body.date ?? todayInIST();
    const result = body.slackUserId
      ? await sendReminderForUser(date, body.slackUserId)
      : await sendRemindersForDate(date);
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

/**
 * GET /attendance/stats/:slackUserId/detail
 * Modal payload: rolling stats + approved/unapproved WFH/leave + ETA history.
 */
attendanceRouter.get("/stats/:slackUserId/detail", async (req, res, next) => {
  try {
    const query = userDetailQuerySchema.parse(req.query);
    const data = await getAttendanceUserDetail(param(req.params.slackUserId), query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /attendance/stats/:slackUserId/reset-counts — zero WFH/leave/etc counters */
attendanceRouter.post("/stats/:slackUserId/reset-counts", async (req, res, next) => {
  try {
    const data = await resetAttendancePersonCounts(param(req.params.slackUserId));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /attendance/stats/:slackUserId/set-counts — set rolling counters to exact values */
attendanceRouter.post("/stats/:slackUserId/set-counts", async (req, res, next) => {
  try {
    const body = setPersonStatsCountsSchema.parse(req.body);
    const data = await setAttendancePersonCounts(param(req.params.slackUserId), body);
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

/** GET /attendance/policies — leave / WFH / ETA policy markdown */
attendanceRouter.get("/policies", async (_req, res, next) => {
  try {
    const data = await getAttendancePolicy();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** PUT /attendance/policies — admin/CoS edit policy markdown in-app */
attendanceRouter.put("/policies", async (req, res, next) => {
  try {
    const body = updateAttendancePolicySchema.parse(req.body ?? {});
    const data = await updateAttendancePolicy({
      bodyMd: body.bodyMd,
      updatedById: req.user!.userId
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

/** Escalation tracker — Slack escalation group/channel */
attendanceRouter.use("/escalations", escalationRouter);

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
