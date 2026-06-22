--
-- PostgreSQL database dump
--

\restrict Kz2TZzS6eJBHshnKYt5ghgDgQxn0vKwgWVGeCefBxgchWht2Bz8M85aNTVLiMgb

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."WorkUnit" DROP CONSTRAINT IF EXISTS "WorkUnit_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."WorkUnit" DROP CONSTRAINT IF EXISTS "WorkUnit_audioRecordingId_fkey";
ALTER TABLE IF EXISTS ONLY public."WorkStep" DROP CONSTRAINT IF EXISTS "WorkStep_workUnitId_fkey";
ALTER TABLE IF EXISTS ONLY public."VoiceRecording" DROP CONSTRAINT IF EXISTS "VoiceRecording_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Vision" DROP CONSTRAINT IF EXISTS "Vision_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."VisionUser" DROP CONSTRAINT IF EXISTS "VisionUser_visionId_fkey";
ALTER TABLE IF EXISTS ONLY public."VisionUser" DROP CONSTRAINT IF EXISTS "VisionUser_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."VisionTeam" DROP CONSTRAINT IF EXISTS "VisionTeam_visionId_fkey";
ALTER TABLE IF EXISTS ONLY public."VisionTeam" DROP CONSTRAINT IF EXISTS "VisionTeam_teamId_fkey";
ALTER TABLE IF EXISTS ONLY public."Vertical" DROP CONSTRAINT IF EXISTS "Vertical_ownerUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserPageVisit" DROP CONSTRAINT IF EXISTS "UserPageVisit_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserKpi" DROP CONSTRAINT IF EXISTS "UserKpi_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserKpi" DROP CONSTRAINT IF EXISTS "UserKpi_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."ThumbnailGeneration" DROP CONSTRAINT IF EXISTS "ThumbnailGeneration_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Team" DROP CONSTRAINT IF EXISTS "Team_verticalId_fkey";
ALTER TABLE IF EXISTS ONLY public."Team" DROP CONSTRAINT IF EXISTS "Team_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_teamId_fkey";
ALTER TABLE IF EXISTS ONLY public."TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_reportsToUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."Task" DROP CONSTRAINT IF EXISTS "Task_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."SocialAccount" DROP CONSTRAINT IF EXISTS "SocialAccount_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_roleId_fkey";
ALTER TABLE IF EXISTS ONLY public."RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_permissionId_fkey";
ALTER TABLE IF EXISTS ONLY public."Project" DROP CONSTRAINT IF EXISTS "Project_verticalId_fkey";
ALTER TABLE IF EXISTS ONLY public."Project" DROP CONSTRAINT IF EXISTS "Project_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."ProjectPhase" DROP CONSTRAINT IF EXISTS "ProjectPhase_projectId_fkey";
ALTER TABLE IF EXISTS ONLY public."ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_reportsToUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_projectId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."NavSearchLog" DROP CONSTRAINT IF EXISTS "NavSearchLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryReservation" DROP CONSTRAINT IF EXISTS "InventoryReservation_inventoryItemId_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryReservation" DROP CONSTRAINT IF EXISTS "InventoryReservation_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryReservation" DROP CONSTRAINT IF EXISTS "InventoryReservation_contentNodeResourceId_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryReservation" DROP CONSTRAINT IF EXISTS "InventoryReservation_contentNodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryItemTeam" DROP CONSTRAINT IF EXISTS "InventoryItemTeam_teamId_fkey";
ALTER TABLE IF EXISTS ONLY public."InventoryItemTeam" DROP CONSTRAINT IF EXISTS "InventoryItemTeam_inventoryItemId_fkey";
ALTER TABLE IF EXISTS ONLY public."Idea" DROP CONSTRAINT IF EXISTS "Idea_authorId_fkey";
ALTER TABLE IF EXISTS ONLY public."IdeaMatch" DROP CONSTRAINT IF EXISTS "IdeaMatch_matchedUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."IdeaMatch" DROP CONSTRAINT IF EXISTS "IdeaMatch_ideaId_fkey";
ALTER TABLE IF EXISTS ONLY public."IdeaMatch" DROP CONSTRAINT IF EXISTS "IdeaMatch_candidateIdeaId_fkey";
ALTER TABLE IF EXISTS ONLY public."Content" DROP CONSTRAINT IF EXISTS "Content_teamId_fkey";
ALTER TABLE IF EXISTS ONLY public."Content" DROP CONSTRAINT IF EXISTS "Content_projectId_fkey";
ALTER TABLE IF EXISTS ONLY public."Content" DROP CONSTRAINT IF EXISTS "Content_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNode" DROP CONSTRAINT IF EXISTS "ContentNode_contentId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeTeamMember" DROP CONSTRAINT IF EXISTS "ContentNodeTeamMember_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeTeamMember" DROP CONSTRAINT IF EXISTS "ContentNodeTeamMember_nodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeResource" DROP CONSTRAINT IF EXISTS "ContentNodeResource_reviewedByUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeResource" DROP CONSTRAINT IF EXISTS "ContentNodeResource_requestedByUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeResource" DROP CONSTRAINT IF EXISTS "ContentNodeResource_nodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeResource" DROP CONSTRAINT IF EXISTS "ContentNodeResource_inventoryItemId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeOutput" DROP CONSTRAINT IF EXISTS "ContentNodeOutput_submittedByUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeOutput" DROP CONSTRAINT IF EXISTS "ContentNodeOutput_reviewedByUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeOutput" DROP CONSTRAINT IF EXISTS "ContentNodeOutput_nodeId_fkey";
ALTER TABLE IF EXISTS ONLY public."AiQuery" DROP CONSTRAINT IF EXISTS "AiQuery_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AdhocWork" DROP CONSTRAINT IF EXISTS "AdhocWork_userId_fkey";
DROP INDEX IF EXISTS public."WorkUnit_userId_idx";
DROP INDEX IF EXISTS public."WorkUnit_userId_createdAt_idx";
DROP INDEX IF EXISTS public."WorkUnit_status_idx";
DROP INDEX IF EXISTS public."WorkUnit_nextDueAt_idx";
DROP INDEX IF EXISTS public."WorkUnit_isPrivate_idx";
DROP INDEX IF EXISTS public."WorkUnit_firstDueAt_idx";
DROP INDEX IF EXISTS public."WorkUnit_closedAt_idx";
DROP INDEX IF EXISTS public."WorkUnit_audioRecordingId_idx";
DROP INDEX IF EXISTS public."WorkStep_workUnitId_idx";
DROP INDEX IF EXISTS public."WorkStep_deadline_idx";
DROP INDEX IF EXISTS public."VoiceRecording_userId_idx";
DROP INDEX IF EXISTS public."VoiceRecording_userId_createdAt_idx";
DROP INDEX IF EXISTS public."VoiceRecording_source_idx";
DROP INDEX IF EXISTS public."Vision_startsAt_endsAt_idx";
DROP INDEX IF EXISTS public."Vision_scope_idx";
DROP INDEX IF EXISTS public."Vision_horizon_idx";
DROP INDEX IF EXISTS public."Vision_createdById_idx";
DROP INDEX IF EXISTS public."VisionUser_userId_idx";
DROP INDEX IF EXISTS public."VisionTeam_teamId_idx";
DROP INDEX IF EXISTS public."Vertical_slug_key";
DROP INDEX IF EXISTS public."Vertical_slug_idx";
DROP INDEX IF EXISTS public."Vertical_ownerUserId_idx";
DROP INDEX IF EXISTS public."Vertical_name_key";
DROP INDEX IF EXISTS public."User_roleId_idx";
DROP INDEX IF EXISTS public."User_googleId_idx";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."User_email_idx";
DROP INDEX IF EXISTS public."UserPageVisit_userId_visitCount_idx";
DROP INDEX IF EXISTS public."UserPageVisit_userId_path_key";
DROP INDEX IF EXISTS public."UserPageVisit_userId_lastVisitedAt_idx";
DROP INDEX IF EXISTS public."UserKpi_userId_sortOrder_idx";
DROP INDEX IF EXISTS public."UserKpi_userId_isKey_idx";
DROP INDEX IF EXISTS public."UserKpi_userId_isActive_idx";
DROP INDEX IF EXISTS public."UserKpi_userId_idx";
DROP INDEX IF EXISTS public."UserKpi_createdById_idx";
DROP INDEX IF EXISTS public."ThumbnailGeneration_userId_createdAt_idx";
DROP INDEX IF EXISTS public."Team_verticalId_idx";
DROP INDEX IF EXISTS public."Team_name_idx";
DROP INDEX IF EXISTS public."Team_createdById_idx";
DROP INDEX IF EXISTS public."TeamMember_userId_idx";
DROP INDEX IF EXISTS public."TeamMember_teamId_userId_key";
DROP INDEX IF EXISTS public."TeamMember_teamId_idx";
DROP INDEX IF EXISTS public."TeamMember_reportsToUserId_idx";
DROP INDEX IF EXISTS public."Task_userId_status_idx";
DROP INDEX IF EXISTS public."Task_userId_idx";
DROP INDEX IF EXISTS public."Task_userId_createdAt_idx";
DROP INDEX IF EXISTS public."Task_type_platform_idx";
DROP INDEX IF EXISTS public."Task_status_idx";
DROP INDEX IF EXISTS public."SocialAccount_userId_platform_platformAccountId_key";
DROP INDEX IF EXISTS public."SocialAccount_userId_idx";
DROP INDEX IF EXISTS public."Role_name_key";
DROP INDEX IF EXISTS public."Project_verticalId_idx";
DROP INDEX IF EXISTS public."Project_status_idx";
DROP INDEX IF EXISTS public."Project_name_idx";
DROP INDEX IF EXISTS public."Project_createdById_idx";
DROP INDEX IF EXISTS public."ProjectPhase_projectId_orderIndex_idx";
DROP INDEX IF EXISTS public."ProjectPhase_projectId_idx";
DROP INDEX IF EXISTS public."ProjectPhase_deadline_idx";
DROP INDEX IF EXISTS public."ProjectMember_userId_idx";
DROP INDEX IF EXISTS public."ProjectMember_reportsToUserId_idx";
DROP INDEX IF EXISTS public."ProjectMember_projectId_userId_key";
DROP INDEX IF EXISTS public."ProjectMember_projectId_idx";
DROP INDEX IF EXISTS public."Permission_name_key";
DROP INDEX IF EXISTS public."Notification_userId_readAt_idx";
DROP INDEX IF EXISTS public."Notification_userId_dedupeKey_key";
DROP INDEX IF EXISTS public."Notification_userId_createdAt_idx";
DROP INDEX IF EXISTS public."NavSearchLog_userId_createdAt_idx";
DROP INDEX IF EXISTS public."InventoryReservation_status_dueBackAt_idx";
DROP INDEX IF EXISTS public."InventoryReservation_inventoryItemId_status_idx";
DROP INDEX IF EXISTS public."InventoryReservation_dueBackAt_idx";
DROP INDEX IF EXISTS public."InventoryReservation_contentNodeResourceId_key";
DROP INDEX IF EXISTS public."InventoryReservation_contentNodeId_idx";
DROP INDEX IF EXISTS public."InventoryItem_status_idx";
DROP INDEX IF EXISTS public."InventoryItem_name_idx";
DROP INDEX IF EXISTS public."InventoryItem_isActive_idx";
DROP INDEX IF EXISTS public."InventoryItem_category_idx";
DROP INDEX IF EXISTS public."InventoryItemTeam_teamId_idx";
DROP INDEX IF EXISTS public."InstagramPerformance_source_mentionedAt_idx";
DROP INDEX IF EXISTS public."InstagramPerformance_source_language_mentionedAt_idx";
DROP INDEX IF EXISTS public."InstagramPerformance_sourceItemId_key";
DROP INDEX IF EXISTS public."InstagramPerformance_mentionedAt_idx";
DROP INDEX IF EXISTS public."InstagramPerformance_language_mentionedAt_idx";
DROP INDEX IF EXISTS public."Idea_createdAt_idx";
DROP INDEX IF EXISTS public."Idea_authorId_idx";
DROP INDEX IF EXISTS public."Idea_authorId_createdAt_idx";
DROP INDEX IF EXISTS public."IdeaMatch_score_idx";
DROP INDEX IF EXISTS public."IdeaMatch_matchedUserId_createdAt_idx";
DROP INDEX IF EXISTS public."IdeaMatch_ideaId_idx";
DROP INDEX IF EXISTS public."IdeaMatch_ideaId_candidateIdeaId_matchedUserId_key";
DROP INDEX IF EXISTS public."Content_type_idx";
DROP INDEX IF EXISTS public."Content_teamId_idx";
DROP INDEX IF EXISTS public."Content_status_idx";
DROP INDEX IF EXISTS public."Content_projectId_idx";
DROP INDEX IF EXISTS public."Content_createdById_idx";
DROP INDEX IF EXISTS public."ContentNode_contentId_orderIndex_key";
DROP INDEX IF EXISTS public."ContentNode_contentId_orderIndex_idx";
DROP INDEX IF EXISTS public."ContentNodeTeamMember_userId_idx";
DROP INDEX IF EXISTS public."ContentNodeTeamMember_nodeId_userId_role_key";
DROP INDEX IF EXISTS public."ContentNodeTeamMember_nodeId_idx";
DROP INDEX IF EXISTS public."ContentNodeResource_nodeId_sourceType_idx";
DROP INDEX IF EXISTS public."ContentNodeResource_nodeId_idx";
DROP INDEX IF EXISTS public."ContentNodeResource_nodeId_approvalState_idx";
DROP INDEX IF EXISTS public."ContentNodeResource_inventoryItemId_idx";
DROP INDEX IF EXISTS public."ContentNodeOutput_nodeId_idx";
DROP INDEX IF EXISTS public."ContentNodeOutput_nodeId_approvalState_idx";
DROP INDEX IF EXISTS public."AiQuery_userId_createdAt_idx";
DROP INDEX IF EXISTS public."AiQuery_scope_targetUserId_rangeFrom_rangeTo_idx";
DROP INDEX IF EXISTS public."AiQuery_normalizedQuery_idx";
DROP INDEX IF EXISTS public."AdhocWork_userId_idx";
DROP INDEX IF EXISTS public."AdhocWork_userId_createdAt_idx";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."WorkUnit" DROP CONSTRAINT IF EXISTS "WorkUnit_pkey";
ALTER TABLE IF EXISTS ONLY public."WorkStep" DROP CONSTRAINT IF EXISTS "WorkStep_pkey";
ALTER TABLE IF EXISTS ONLY public."VoiceRecording" DROP CONSTRAINT IF EXISTS "VoiceRecording_pkey";
ALTER TABLE IF EXISTS ONLY public."Vision" DROP CONSTRAINT IF EXISTS "Vision_pkey";
ALTER TABLE IF EXISTS ONLY public."VisionUser" DROP CONSTRAINT IF EXISTS "VisionUser_pkey";
ALTER TABLE IF EXISTS ONLY public."VisionTeam" DROP CONSTRAINT IF EXISTS "VisionTeam_pkey";
ALTER TABLE IF EXISTS ONLY public."Vertical" DROP CONSTRAINT IF EXISTS "Vertical_pkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."UserPageVisit" DROP CONSTRAINT IF EXISTS "UserPageVisit_pkey";
ALTER TABLE IF EXISTS ONLY public."UserKpi" DROP CONSTRAINT IF EXISTS "UserKpi_pkey";
ALTER TABLE IF EXISTS ONLY public."ThumbnailGeneration" DROP CONSTRAINT IF EXISTS "ThumbnailGeneration_pkey";
ALTER TABLE IF EXISTS ONLY public."Team" DROP CONSTRAINT IF EXISTS "Team_pkey";
ALTER TABLE IF EXISTS ONLY public."TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_pkey";
ALTER TABLE IF EXISTS ONLY public."Task" DROP CONSTRAINT IF EXISTS "Task_pkey";
ALTER TABLE IF EXISTS ONLY public."SocialAccount" DROP CONSTRAINT IF EXISTS "SocialAccount_pkey";
ALTER TABLE IF EXISTS ONLY public."Role" DROP CONSTRAINT IF EXISTS "Role_pkey";
ALTER TABLE IF EXISTS ONLY public."RolePermission" DROP CONSTRAINT IF EXISTS "RolePermission_pkey";
ALTER TABLE IF EXISTS ONLY public."Project" DROP CONSTRAINT IF EXISTS "Project_pkey";
ALTER TABLE IF EXISTS ONLY public."ProjectPhase" DROP CONSTRAINT IF EXISTS "ProjectPhase_pkey";
ALTER TABLE IF EXISTS ONLY public."ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_pkey";
ALTER TABLE IF EXISTS ONLY public."Permission" DROP CONSTRAINT IF EXISTS "Permission_pkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_pkey";
ALTER TABLE IF EXISTS ONLY public."NavSearchLog" DROP CONSTRAINT IF EXISTS "NavSearchLog_pkey";
ALTER TABLE IF EXISTS ONLY public."InventoryReservation" DROP CONSTRAINT IF EXISTS "InventoryReservation_pkey";
ALTER TABLE IF EXISTS ONLY public."InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_pkey";
ALTER TABLE IF EXISTS ONLY public."InventoryItemTeam" DROP CONSTRAINT IF EXISTS "InventoryItemTeam_pkey";
ALTER TABLE IF EXISTS ONLY public."InstagramPerformance" DROP CONSTRAINT IF EXISTS "InstagramPerformance_pkey";
ALTER TABLE IF EXISTS ONLY public."Idea" DROP CONSTRAINT IF EXISTS "Idea_pkey";
ALTER TABLE IF EXISTS ONLY public."IdeaMatch" DROP CONSTRAINT IF EXISTS "IdeaMatch_pkey";
ALTER TABLE IF EXISTS ONLY public."Content" DROP CONSTRAINT IF EXISTS "Content_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentNode" DROP CONSTRAINT IF EXISTS "ContentNode_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeTeamMember" DROP CONSTRAINT IF EXISTS "ContentNodeTeamMember_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeResource" DROP CONSTRAINT IF EXISTS "ContentNodeResource_pkey";
ALTER TABLE IF EXISTS ONLY public."ContentNodeOutput" DROP CONSTRAINT IF EXISTS "ContentNodeOutput_pkey";
ALTER TABLE IF EXISTS ONLY public."AiQuery" DROP CONSTRAINT IF EXISTS "AiQuery_pkey";
ALTER TABLE IF EXISTS ONLY public."AdhocWork" DROP CONSTRAINT IF EXISTS "AdhocWork_pkey";
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."WorkUnit";
DROP TABLE IF EXISTS public."WorkStep";
DROP TABLE IF EXISTS public."VoiceRecording";
DROP TABLE IF EXISTS public."VisionUser";
DROP TABLE IF EXISTS public."VisionTeam";
DROP TABLE IF EXISTS public."Vision";
DROP TABLE IF EXISTS public."Vertical";
DROP TABLE IF EXISTS public."UserPageVisit";
DROP TABLE IF EXISTS public."UserKpi";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."ThumbnailGeneration";
DROP TABLE IF EXISTS public."TeamMember";
DROP TABLE IF EXISTS public."Team";
DROP TABLE IF EXISTS public."Task";
DROP TABLE IF EXISTS public."SocialAccount";
DROP TABLE IF EXISTS public."RolePermission";
DROP TABLE IF EXISTS public."Role";
DROP TABLE IF EXISTS public."ProjectPhase";
DROP TABLE IF EXISTS public."ProjectMember";
DROP TABLE IF EXISTS public."Project";
DROP TABLE IF EXISTS public."Permission";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."NavSearchLog";
DROP TABLE IF EXISTS public."InventoryReservation";
DROP TABLE IF EXISTS public."InventoryItemTeam";
DROP TABLE IF EXISTS public."InventoryItem";
DROP TABLE IF EXISTS public."InstagramPerformance";
DROP TABLE IF EXISTS public."IdeaMatch";
DROP TABLE IF EXISTS public."Idea";
DROP TABLE IF EXISTS public."ContentNodeTeamMember";
DROP TABLE IF EXISTS public."ContentNodeResource";
DROP TABLE IF EXISTS public."ContentNodeOutput";
DROP TABLE IF EXISTS public."ContentNode";
DROP TABLE IF EXISTS public."Content";
DROP TABLE IF EXISTS public."AiQuery";
DROP TABLE IF EXISTS public."AdhocWork";
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdhocWork; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AdhocWork" (
    id text NOT NULL,
    "userId" text NOT NULL,
    description text NOT NULL,
    "effortHours" double precision,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    output text
);


--
-- Name: AiQuery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiQuery" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "rawQuery" text NOT NULL,
    "normalizedQuery" character varying(1000) NOT NULL,
    scope text NOT NULL,
    "targetUserId" text,
    "targetName" text,
    "rangeFrom" timestamp(3) without time zone NOT NULL,
    "rangeTo" timestamp(3) without time zone NOT NULL,
    report text NOT NULL,
    meta text,
    cached boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Content" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "teamId" text NOT NULL,
    "projectId" text NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContentNode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentNode" (
    id text NOT NULL,
    "contentId" text NOT NULL,
    kind text NOT NULL,
    name text NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    "startsAt" timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContentNodeOutput; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentNodeOutput" (
    id text NOT NULL,
    "nodeId" text NOT NULL,
    label text NOT NULL,
    url text NOT NULL,
    notes text,
    version integer DEFAULT 1 NOT NULL,
    "submittedByUserId" text,
    "approvalState" text DEFAULT 'PENDING'::text NOT NULL,
    "reviewNote" text,
    "reviewedByUserId" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ContentNodeResource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentNodeResource" (
    id text NOT NULL,
    "nodeId" text NOT NULL,
    name text NOT NULL,
    "sourceType" text DEFAULT 'IN_HOUSE'::text NOT NULL,
    cost numeric(18,2),
    quantity integer DEFAULT 1 NOT NULL,
    currency text,
    notes text,
    "approvalState" text DEFAULT 'PENDING'::text NOT NULL,
    "reviewNote" text,
    "requestedByUserId" text,
    "reviewedByUserId" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "inventoryItemId" text
);


--
-- Name: ContentNodeTeamMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ContentNodeTeamMember" (
    id text NOT NULL,
    "nodeId" text NOT NULL,
    "userId" text NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Idea; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Idea" (
    id text NOT NULL,
    "authorId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    tags text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: IdeaMatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."IdeaMatch" (
    id text NOT NULL,
    "ideaId" text NOT NULL,
    "candidateIdeaId" text NOT NULL,
    "matchedUserId" text NOT NULL,
    score double precision NOT NULL,
    status text DEFAULT 'SUGGESTED'::text NOT NULL,
    "notifiedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InstagramPerformance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InstagramPerformance" (
    id text NOT NULL,
    source text DEFAULT 'instagram'::text NOT NULL,
    "sourceItemId" text NOT NULL,
    language text NOT NULL,
    "mentionCount" integer DEFAULT 0 NOT NULL,
    "estimatedViews" integer DEFAULT 0 NOT NULL,
    "estimatedReach" integer DEFAULT 0 NOT NULL,
    engagement integer DEFAULT 0 NOT NULL,
    "engagementCount" integer DEFAULT 0 NOT NULL,
    "engagementRate" double precision DEFAULT 0 NOT NULL,
    sentiment text DEFAULT 'unknown'::text NOT NULL,
    "mentionedAt" timestamp(3) without time zone NOT NULL,
    "rawPayload" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InventoryItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryItem" (
    id text NOT NULL,
    name character varying(500) NOT NULL,
    description text,
    category character varying(200),
    "serialNumber" character varying(200),
    status text DEFAULT 'AVAILABLE'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InventoryItemTeam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryItemTeam" (
    "inventoryItemId" text NOT NULL,
    "teamId" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InventoryReservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryReservation" (
    id text NOT NULL,
    "inventoryItemId" text NOT NULL,
    "contentNodeId" text NOT NULL,
    "contentNodeResourceId" text NOT NULL,
    "reservedFrom" timestamp(3) without time zone NOT NULL,
    "dueBackAt" timestamp(3) without time zone NOT NULL,
    "returnedAt" timestamp(3) without time zone,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    notes text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: NavSearchLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NavSearchLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    query character varying(500) NOT NULL,
    "selectedPath" character varying(500),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text,
    data text,
    "dedupeKey" text,
    "readAt" timestamp(3) without time zone,
    "emailSentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Permission" (
    id text NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: Project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    objectives text,
    "finalLink" text,
    "verticalId" text NOT NULL,
    "createdById" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ProjectMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProjectMember" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "userId" text NOT NULL,
    "memberRole" text DEFAULT 'MEMBER'::text NOT NULL,
    "reportsToUserId" text,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: ProjectPhase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ProjectPhase" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    name text NOT NULL,
    objectives text,
    deadline timestamp(3) without time zone,
    status text DEFAULT 'PLANNED'::text NOT NULL,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RolePermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RolePermission" (
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


--
-- Name: SocialAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SocialAccount" (
    id text NOT NULL,
    "userId" text NOT NULL,
    platform text NOT NULL,
    "platformAccountId" text NOT NULL,
    handle text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'GENERAL'::text NOT NULL,
    platform text,
    "contentUrl" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    metadata text,
    "dueDate" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "verticalId" text NOT NULL,
    "createdById" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TeamMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeamMember" (
    id text NOT NULL,
    "teamId" text NOT NULL,
    "userId" text NOT NULL,
    "memberRole" text DEFAULT 'MEMBER'::text NOT NULL,
    "reportsToUserId" text,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


--
-- Name: ThumbnailGeneration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ThumbnailGeneration" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "inputTitle" character varying(500) NOT NULL,
    "inputDescription" text NOT NULL,
    "inputContext" text,
    "referencePaths" text NOT NULL,
    "outputTitle" character varying(500) NOT NULL,
    "outputTextDescription" text NOT NULL,
    "outputContext" text NOT NULL,
    assets text NOT NULL,
    "designBrief" text NOT NULL,
    "styleFromReferences" text NOT NULL,
    "generatedImagePath" character varying(1000),
    "generatedMimeType" character varying(100),
    "generatedFileSizeBytes" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "googleId" text,
    email text NOT NULL,
    name text NOT NULL,
    "avatarUrl" text,
    description text,
    phone text,
    designation text,
    "passwordHash" text,
    "roleId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserKpi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserKpi" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title character varying(500) NOT NULL,
    description text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isKey" boolean DEFAULT false NOT NULL
);


--
-- Name: UserPageVisit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPageVisit" (
    id text NOT NULL,
    "userId" text NOT NULL,
    path character varying(500) NOT NULL,
    "visitCount" integer DEFAULT 1 NOT NULL,
    "lastVisitedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Vertical; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Vertical" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "ownerUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Vision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Vision" (
    id text NOT NULL,
    title character varying(500) NOT NULL,
    description text,
    horizon text NOT NULL,
    "durationMonths" integer NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone NOT NULL,
    scope text NOT NULL,
    "originalFilename" character varying(500) NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSizeBytes" integer NOT NULL,
    "storagePath" character varying(1000) NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: VisionTeam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VisionTeam" (
    "visionId" text NOT NULL,
    "teamId" text NOT NULL
);


--
-- Name: VisionUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VisionUser" (
    "visionId" text NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: VoiceRecording; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VoiceRecording" (
    id text NOT NULL,
    "userId" text NOT NULL,
    source text NOT NULL,
    "originalFilename" character varying(500) NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSizeBytes" integer NOT NULL,
    "storagePath" character varying(1000) NOT NULL,
    transcript text,
    "sarvamRequestId" character varying(200),
    "languageCode" character varying(20),
    "languageProbability" double precision,
    status text DEFAULT 'COMPLETED'::text NOT NULL,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WorkStep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkStep" (
    id text NOT NULL,
    "workUnitId" text NOT NULL,
    description text NOT NULL,
    deadline timestamp(3) without time zone,
    done boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: WorkUnit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkUnit" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title character varying(500) NOT NULL,
    context text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "isPrivate" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "nextDueAt" timestamp(3) without time zone,
    "firstDueAt" timestamp(3) without time zone,
    "audioRecordingId" text
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: AdhocWork; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AdhocWork" (id, "userId", description, "effortHours", "createdAt", "updatedAt", output) FROM stdin;
b1b95ff0-bd98-4ec8-b416-f51138f2e9d1	cc8da27e-4a59-474a-93fe-adfd1589382c	I worked all night	4.5	2026-06-04 10:50:04.043	2026-06-04 10:50:04.043	\N
7895ef70-987b-4082-8a3d-186169d319c6	de5dd353-4173-41b4-8f28-b372fd204c52	Testing of Elevator Pitch, BRAN and alllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll	4	2026-06-09 10:25:49.972	2026-06-09 10:37:12.331	Test Outputtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt
5f2c6739-e5fb-4239-b61f-7c5bfd468e12	de5dd353-4173-41b4-8f28-b372fd204c52	Worked on bran todayyyyyyy	4.5	2026-06-16 15:44:25.296	2026-06-16 15:44:51.737	\N
54135c65-2932-4c1a-8354-ed0dfec713d6	de5dd353-4173-41b4-8f28-b372fd204c52	Okayyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy	\N	2026-06-18 10:39:53.625	2026-06-18 10:39:53.625	\N
\.


--
-- Data for Name: AiQuery; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiQuery" (id, "userId", "rawQuery", "normalizedQuery", scope, "targetUserId", "targetName", "rangeFrom", "rangeTo", report, meta, cached, "expiresAt", "createdAt") FROM stdin;
7ff8248a-49c7-4b51-9519-ca843d7c132b	cc8da27e-4a59-474a-93fe-adfd1589382c	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-05-31 18:30:00	2026-06-05 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team logged minimal formal activity this week, with only adhoc work recorded. One team member contributed 4.5 hours of unscheduled effort.\n\n## Highlights\n- Completed overnight work session (4.5 hrs logged on June 4)\n\n## Metrics\n- Adhoc work entries: 1\n- Total effort hours: 4.5\n- Formal tasks completed: 0\n\n## Concerns / Next Steps\n- No structured tasks logged; recommend clarifying task tracking process\n- Consider documenting the nature of the overnight work for visibility and workload assessment	{"user":{"id":null,"name":"team","memberCount":3},"scope":"team","timeRange":{"from":"2026-05-31T18:30:00.000Z","to":"2026-06-05T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":1,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false}	f	2026-06-05 13:06:49.786	2026-06-05 12:56:49.788
f06fccd8-fa1b-49b4-a596-aeb868818bc0	058c404a-165c-4ccc-a0d4-eacf23950652	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-07 18:30:00	2026-06-08 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team has no completed tasks or adhoc work logged this period. Four open work units are pending, primarily consisting of scheduled meetings and follow-ups.\n\n## Work Units in Progress\n- **Contact Abhay Mehta** – Discussion about context layer team (no deadline set)\n- **Meeting with Arun** – Scheduled for 6:30 PM (by 2026-06-08)\n- **Student follow-ups** – Four follow-up meetings required (by 2026-06-09)\n- **Friday follow-up meeting** – Scheduled (by 2026-06-13)\n\n## Concerns / Next Steps\n- **No task completion or logged effort** – No formal tasks or adhoc work recorded; recommend clarifying how work is being tracked\n- **Upcoming deadline:** Student follow-up meetings due by 2026-06-09\n- **Action needed:** Confirm meeting with Arun and ensure follow-ups are scheduled with students from today's sessions	{"user":{"id":null,"name":"team","memberCount":3},"scope":"team","timeRange":{"from":"2026-06-07T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":4,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-08 12:03:57.199	2026-06-08 11:53:57.204
7e4411f6-024d-4b85-b808-fb9ecb098aa9	058c404a-165c-4ccc-a0d4-eacf23950652	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-07 18:30:00	2026-06-08 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team has no completed tasks or adhoc work logged this period. Four open work units are pending, primarily consisting of scheduled meetings and follow-ups.\n\n## Work Units in Progress\n- **Contact Abhay Mehta** – Discussion about context layer team (no deadline set)\n- **Meeting with Arun** – Scheduled for 6:30 PM (by 2026-06-08)\n- **Student follow-ups** – Four follow-up meetings required (by 2026-06-09)\n- **Friday follow-up meeting** – Scheduled (by 2026-06-13)\n\n## Concerns / Next Steps\n- **No task completion or logged effort** – No formal tasks or adhoc work recorded; recommend clarifying how work is being tracked\n- **Upcoming deadline:** Student follow-up meetings due by 2026-06-09\n- **Action needed:** Confirm meeting with Arun and ensure follow-ups are scheduled with students from today's sessions	{"user":{"id":null,"name":"team","memberCount":3},"scope":"team","timeRange":{"from":"2026-06-07T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":4,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false,"cached":true}	t	2026-06-08 12:03:57.199	2026-06-08 11:54:02.283
f50bb265-bef3-4220-94d1-d176f65ed9a2	058c404a-165c-4ccc-a0d4-eacf23950652	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-07 18:30:00	2026-06-08 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team completed onboarding activities and content reviews this week while managing multiple upcoming event deadlines. Focus areas include demo day finale completion, Startup Weekend Instagram coverage planning, and student engagement follow-ups.\n\n## Highlights\n- **Onboarded Sudipto** as new head of socials; reviewed current Instagram operations and content strategy (student stories focus)\n- **Reviewed scripts** from B bus team for student stories content\n- **Met with UG team** to plan Instagram coverage strategy for Startup Weekend (June 13-14)\n- **Conducted four student meetings** requiring structured follow-ups\n\n## Metrics\n- **9 work units** in progress (7 open, 2 closed)\n- **2 upcoming deadlines** this week (June 8 & 13)\n- **0 formal tasks** logged; all work tracked via work units\n\n## Concerns / Next Steps\n**Immediate priorities:**\n- Follow up with Samar on demo day finale stories completion (due **today, June 8**)\n- Review Mani's two demo day finale videos\n- Execute Instagram stories and hype content for Startup Weekend (due **June 13**)\n- Conduct student follow-up meetings (due **June 9**)\n- Contact Abhay Mehta re: context layer team	{"user":{"id":null,"name":"team","memberCount":3},"scope":"team","timeRange":{"from":"2026-06-07T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":9,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-08 12:21:31.775	2026-06-08 12:11:31.776
a4f4bebf-dd65-471e-9744-620b5005cfec	058c404a-165c-4ccc-a0d4-eacf23950652	what do I need t di by thsi week	what do i need t di by thsi week	user	058c404a-165c-4ccc-a0d4-eacf23950652	Sudeep Purwar	2026-05-31 18:30:00	2026-06-08 18:29:59.999	# Team Performance Report: Sudeep Purwar\n\n## Summary\nSudeep has 7 open work units focused on event coverage, content review, and stakeholder meetings. Two critical deadlines this week: demo day finale stories (by 6/8) and student follow-ups (by 6/9).\n\n## Highlights\n- Onboarded Sudipto on Instagram operations and content strategy\n- Reviewed scripts from B bus team for student stories content\n- Met with UG team to plan Startup Weekend Instagram coverage (June 13–14)\n- Scheduled meetings with Arun and follow-up sessions with students\n\n## Metrics\n- **Open work units:** 7\n- **Closed work units:** 2\n- **Upcoming deadlines this week:** 2 (6/8, 6/9)\n- **Key events:** Demo day finale (stories due today), Startup Weekend (June 13–14)\n\n## Concerns / Next Steps\n**Immediate action required:**\n- Follow up with Samar on demo day finale stories completion (due 6/8)\n- Review two videos from Mani for demo day finale\n- Conduct follow-up meetings with students from today's sessions (due 6/9)\n- Contact Abhay Mehta re: context layer team\n- Prepare Instagram content and hype-building posts for Startup Weekend launch	{"user":{"id":"058c404a-165c-4ccc-a0d4-eacf23950652","name":"Sudeep Purwar"},"scope":"user","timeRange":{"from":"2026-05-31T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":9,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-08 12:22:37.704	2026-06-08 12:12:37.705
d70b646e-dc8f-49ea-89dd-d13245e49b33	058c404a-165c-4ccc-a0d4-eacf23950652	what dO i need to do on 14th	what do i need to do on 14th	user	058c404a-165c-4ccc-a0d4-eacf23950652	Sudeep Purwar	2026-05-31 18:30:00	2026-06-08 18:29:59.999	# Performance Report: Sudeep Purwar\n\n## Summary\nSudeep is managing a major **Elevator Pitch Event in Bangalore (June 13-14)** with multiple critical deadlines converging this week. Several high-priority items are due by June 9th that will unlock downstream execution.\n\n## Highlights\n- Completed demo day finale stories follow-up and onboarded new social media head (Sudipto)\n- Reviewed student story scripts and demo day finale videos\n- Held stakeholder meeting on elevator pitch production plan\n- Met with UG team to plan Instagram coverage strategy for concurrent Startup Weekend event\n\n## Metrics\n- **14 open work units** across event logistics, communications, and content\n- **4 critical deadlines by June 9th**: finalize event date, lock guest list, send MOU to partner, confirm student participant assignments\n- **2 concurrent events**: Elevator Pitch (June 13-14) + Startup Weekend (June 13-14)\n\n## Concerns / Next Steps\n**By June 14th you need to:**\n- Execute full 2-day shooting schedule (10 AM–8 PM both days)\n- Organize team celebration post-event\n\n**Immediate blockers (by June 9th):**\n- Determine final event date (June 13 vs 14) — impacts 100 student communications\n- Lock 10-person VC/founder judge list\n- Send MOU to Hub partner for signatures\n- Follow up with students from four recent meetings	{"user":{"id":"058c404a-165c-4ccc-a0d4-eacf23950652","name":"Sudeep Purwar"},"scope":"user","timeRange":{"from":"2026-05-31T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":17,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-08 13:31:53.646	2026-06-08 13:21:53.647
81f0e705-3fe6-4803-8fde-75b13b3ac172	058c404a-165c-4ccc-a0d4-eacf23950652	what do I need to et done by today	what do i need to et done by today	user	058c404a-165c-4ccc-a0d4-eacf23950652	Sudeep Purwar	2026-06-07 18:30:00	2026-06-08 18:29:59.999	# Team Performance Report: Sudeep Purwar\n\n## Summary\nSudeep has 20 open work units across two major initiatives: the Dropout Fund campaign (creator coordination, UTM setup, live sessions) and the Bangalore Elevator Pitch Event (logistics, guest confirmation, student communication). **10 deadlines are due by June 9th**, requiring immediate action today.\n\n## Highlights\n- Completed demo day finale stories follow-up and onboarded new social media head (Sudipto)\n- Reviewed student story scripts and demo day finale videos\n- Held stakeholder meeting on elevator pitch event production planning\n- Established Instagram coverage strategy for Startup Weekend event\n\n## Metrics\n- **20 open work units** across campaign and event management\n- **10 upcoming deadlines** (most by 2026-06-09)\n- **3 completed units** (demo day stories, Sudipto onboarding, script review)\n\n## Concerns / Next Steps\n**TODAY (2026-06-08) priorities:**\n- Book flights for 5 team members to Bangalore\n- Create Nasdaily UTM link; learn UTM creation process from Tanjit\n- Update creator status sheet and notify Sudeepto\n- Get daily creator status updates from Raghav\n- Send MOU/partnership agreement to Hub\n- Meet with Arun at 6:30 PM\n\n**By June 9th:** Confirm guest list, lock production plan, determine final event date, communicate pitch dates to 100 students, send MOU signatures.	{"user":{"id":"058c404a-165c-4ccc-a0d4-eacf23950652","name":"Sudeep Purwar"},"scope":"user","timeRange":{"from":"2026-06-07T18:30:00.000Z","to":"2026-06-08T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":23,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-08 13:47:06.973	2026-06-08 13:37:06.974
cdb263a5-2cc8-4d31-b1a1-4227921dd511	cc8da27e-4a59-474a-93fe-adfd1589382c	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-07 18:30:00	2026-06-09 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team is managing multiple concurrent initiatives with significant activity ahead. No traditional tasks were logged this period, but 29 work units are active, with 18 upcoming deadlines concentrated between June 8–16. Focus areas include a dropout fund campaign launch, Bangalore elevator pitch event execution, and creator coordination.\n\n## Highlights\n- **Closed 7 work units**: Flights booked for Bangalore team travel, guest list confirmed for elevator pitch event, demo day finale stories completed, Sudipto onboarded on social media strategy, scripts reviewed, and daily creator status tracking initiated\n- **Campaign readiness**: 11 creators lined up for dropout fund campaign; UTM link creation and creator live session planning underway\n- **Event logistics advancing**: Location recce scheduled (June 11–12), venue setup begins June 13, two-day shooting event planned with ~100 student participants\n\n## Metrics\n- **22 open work units** requiring active management\n- **18 deadlines** in next 8 days (June 8–16)\n- **Critical path items**: Campaign launch (June 8), Bangalore recce (June 11), event execution (June 13–14)\n\n## Concerns / Next Steps\n**Immediate priorities (by June 8–9)**:\n- Finalize UTM links and creator status tracking for campaign\n- Confirm event date and communicate to 100 students\n- Send MOU to Hub partner\n- Lock production plan for elevator pitch event\n\n**Execution phase (June 11–16)**: Bangalore location recce, event setup, and two-day shooting with concurrent campaign amplification phase.	{"user":{"id":null,"name":"team","memberCount":3},"scope":"team","timeRange":{"from":"2026-06-07T18:30:00.000Z","to":"2026-06-09T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":29,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-09 05:09:12.051	2026-06-09 04:59:12.052
0c593582-b637-4199-a9ef-0d1cabe456a3	de5dd353-4173-41b4-8f28-b372fd204c52	Show me the task report for last week	show me the task report for last week	user	de5dd353-4173-41b4-8f28-b372fd204c52	Amisha Sharma	2026-06-01 00:00:00	2026-06-07 23:59:59.999	# Team Performance Report: Amisha Sharma\n\n**Summary**\n\nNo tasks, adhoc work, or work units were logged for this period.\n\n**Metrics**\n\n- Total tasks: 0\n- Adhoc work entries: 0\n- Work units: 0	{"user":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma"},"scope":"user","timeRange":{"from":"2026-06-01T00:00:00.000Z","to":"2026-06-07T23:59:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	\N	2026-06-10 06:48:36.706
553e248a-8cd7-4e20-8c98-cf46fe097d34	de5dd353-4173-41b4-8f28-b372fd204c52	Show me the task report for yesterday	show me the task report for yesterday	user	de5dd353-4173-41b4-8f28-b372fd204c52	Amisha Sharma	2026-06-09 00:00:00	2026-06-09 23:59:59.999	# Task Report for Amisha Sharma\n\n## Summary\nAmisha logged 4 hours of adhoc testing work yesterday with no formal tasks completed. Six work units remain open with multiple upcoming deadlines requiring immediate attention.\n\n## Highlights\n- Completed testing of Elevator Pitch and BRAN materials (4 hrs)\n- Reviewed latest website changes with design team\n- Discussed pending sprint deliverables with UG team\n- Coordinated college event planning arrangements\n\n## Metrics\n- Adhoc work: 4 hours logged\n- Open work units: 6\n- Upcoming deadlines: 4\n- Completed tasks: 0\n\n## Concerns / Next Steps\n**Immediate deadlines (by 2026-06-09):**\n- Event Planning: CALL required\n- Meeting with UG team: Follow-up on action items (by 2026-06-10)\n- Team Intro: Calls with Sudeep and Dhannjay\n\n**In progress:**\n- Website review feedback: Verify fixes due 2026-06-13\n\nAll work units are open with pending next steps—prioritize deadline items and clarify ownership to prevent bottlenecks.	{"user":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma"},"scope":"user","timeRange":{"from":"2026-06-09T00:00:00.000Z","to":"2026-06-09T23:59:59.999Z"},"taskCount":0,"adhocWorkCount":1,"workUnitCount":6,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	\N	2026-06-10 06:54:32.584
85da442e-9930-4afa-981f-3a8c48d1749b	058c404a-165c-4ccc-a0d4-eacf23950652	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-08 00:00:00	2026-06-10 23:59:59.999	# Team Performance Report\n\n## Summary\nThe team is managing a high-volume week with 26 open work units across multiple concurrent initiatives: a major Dropout Fund campaign with 11 creators, an Elevator Pitch Event in Bangalore (June 13–14), and ongoing content/Instagram operations. One adhoc testing task (4 hrs) was completed.\n\n## Highlights\n- **Closed 7 work units** including flights booked for Bangalore team travel, guest list confirmed for Elevator Pitch, demo day finale stories completed, and Sudipto onboarded on social media strategy\n- **Campaign execution underway**: Dropout Fund campaign entering live phase with 11 creators; UTM link creation and creator status tracking in progress\n- **Event logistics advancing**: Location recce scheduled (by 6/12), venue setup begins 6/13, Day 2 shooting completed\n- **Stakeholder alignment**: Meetings held with UG team, Sudipto (new head of socials), and production team for Elevator Pitch event\n\n## Metrics\n- **22 upcoming deadlines** across next 7 days (critical path: 6/8–6/14)\n- **26 open work units** requiring active management\n- **Key bottlenecks**: UTM link creation, creator live session cadence planning, influencer collabs list updates, student pitch date communication (due 6/9)\n\n## Concerns / Next Steps\n- **Immediate (by 6/9)**: Finalize event dates, communicate to 100 students, send MOU to Hub, lock production plan, complete UTM links for Nasdaily\n- **Bangalore trip (6/11–6/14)**: Location recce, venue setup, two-day event execution with team celebration post-event\n- **Campaign phase transition**: Confirm amplification costings with Chirag before moving to phase 2	{"user":{"id":null,"name":"team","memberCount":4},"scope":"team","timeRange":{"from":"2026-06-08T00:00:00.000Z","to":"2026-06-10T23:59:59.999Z"},"taskCount":0,"adhocWorkCount":1,"workUnitCount":33,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-10 10:52:32.759	2026-06-10 10:42:32.76
51deb4b7-f3b8-4158-bb09-b5165cb782f0	de5dd353-4173-41b4-8f28-b372fd204c52	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-08 00:00:00	2026-06-11 23:59:59.999	# Team Performance Report\n\n## Summary\nThe team is managing a high-volume week with 35 active work units focused on two major initiatives: the Dropout Fund campaign (11 creators, UTM tracking, live sessions) and the Bangalore Elevator Pitch Event (June 13–14). One adhoc testing task (4 hrs) was completed. Heavy deadline concentration through June 13.\n\n## Highlights\n- **Elevator Pitch Event**: Flights booked, guest list confirmed, Day 2 shooting completed; Day 1 shooting and venue recce scheduled\n- **Dropout Fund Campaign**: Testing completed; creator live sessions, UTM links, and campaign phases (launch + amplification) in motion\n- **Stakeholder Coordination**: Meetings held with UG team, Sudipto (new socials lead), and B bus team; multiple one-on-ones scheduled\n- **Content Pipeline**: Demo day finale stories completed; website review feedback shared; Instagram coverage strategy planned for Startup Weekend\n\n## Metrics\n- **Work units**: 35 total (28 open, 7 closed)\n- **Upcoming deadlines**: 25 items due by June 13–16\n- **Adhoc effort**: 4 hours (testing)\n- **Key dates**: June 9 (UG meeting, Arun 1:1, Raghav updates), June 11 (Abhay 1:1, Bangalore travel), June 12 (location recce, bag packing), June 13–14 (Elevator Pitch Event)\n\n## Concerns / Next Steps\n**Critical path items due by June 9:** Student pitch date communication, MOU signatures, production plan lock, creator status updates, UTM link creation (Nasdaily priority), UG team follow-ups.  \n**June 11–12:** Bangalore travel and venue recce must complete before event.  \n**Recommend:** Prioritize Nasdaily UTM link and campaign launch sequencing; confirm Elevator Pitch production plan lock.	{"user":{"id":null,"name":"team","memberCount":4},"scope":"team","timeRange":{"from":"2026-06-08T00:00:00.000Z","to":"2026-06-11T23:59:59.999Z"},"taskCount":0,"adhocWorkCount":1,"workUnitCount":35,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-11 07:21:39.183	2026-06-11 07:11:39.184
093799f1-28fc-4f0d-9af4-13e74a254d22	cc8da27e-4a59-474a-93fe-adfd1589382c	what am I suppoosed to work on today	what am i suppoosed to work on today	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-15 18:30:00	2026-06-16 18:29:59.999	# Team Performance Report — Admin\n\n## Summary\nNo tasks, adhoc work, or work units are currently assigned for this period.\n\n## Next Steps\nPlease check with your manager or team lead to receive task assignments, or review your project backlog for items to prioritize.	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-15T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 11:42:41.087	2026-06-16 11:32:41.089
fe016378-148a-4bce-ba2a-ea79c6563da8	cc8da27e-4a59-474a-93fe-adfd1589382c	whats the vsiion of my team for teh next 3 months	whats the vsiion of my team for teh next 3 months	team	\N	Team	2026-06-08 18:30:00	2026-06-16 18:29:59.999	# Team Vision – Next 3 Months\n\n## Summary\nThe team is currently focused on website design refinement and sprint planning with the UG team. Four open work units are in progress with near-term deadlines, supported by targeted testing and feedback cycles.\n\n## Highlights\n- Website review feedback cycle underway with design team\n- Sprint deliverables discussed with UG team; action items being tracked\n- Testing completed on Elevator Pitch and BRAN initiatives (4 hrs)\n- Team onboarding calls scheduled\n\n## Metrics\n- **Work units:** 4 open, 0 closed\n- **Upcoming deadlines:** 6 (starting 2026-06-09)\n- **Adhoc effort:** 4 hours logged\n- **Immediate next steps:** Website fixes verification (by 2026-06-13); follow-up on UG team action items (by 2026-06-10)\n\n## Concerns / Next Steps\n**Immediate action required:** Multiple deadlines clustered around 2026-06-09–2026-06-10 (team intro calls, UG follow-up). Prioritize website fixes verification by 2026-06-13 to unblock design team.	{"user":{"id":null,"name":"team","memberCount":5},"scope":"team","timeRange":{"from":"2026-06-08T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":1,"workUnitCount":4,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 11:43:34.244	2026-06-16 11:33:34.246
d47a3355-a890-4c8b-b8c3-bb2ea47b6f38	cc8da27e-4a59-474a-93fe-adfd1589382c	is this coming from the vision docuemnt	is this coming from the vision docuemnt	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-08 18:30:00	2026-06-16 18:29:59.999	# Quick Check: Vision Alignment\n\n**The short answer:** I can't confirm whether something is coming from the vision document because **no tasks, adhoc work, or work units are logged for you right now**. This makes it impossible to assess alignment.\n\n---\n\n## What I can see:\n- **Vision exists:** "Creative Studio Vision" (12-month, org-wide)\n- **Your activity:** Zero logged work across all categories\n\n---\n\n## What this means:\n\n1. **If you're asking about a specific initiative:** Share the name/description, and I'll cross-reference it against the Creative Studio Vision document.\n\n2. **If you're asking generally:** The lack of logged work suggests either:\n   - Work isn't being tracked/documented\n   - You're in a planning phase before execution\n   - There's a disconnect between what you're doing and what's recorded\n\n---\n\n## Next steps:\n\n- **Share the specific initiative/task** you want me to validate against the vision\n- **Log your current work** (tasks, adhoc, or work units) so I can show you real alignment gaps\n- **Review the Creative Studio Vision document** directly—I can help interpret it once you flag what you're evaluating\n\nWhat specific work or initiative are you checking against the vision?	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-08T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":1,"kpiCount":0,"guidanceQuery":true,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 11:44:02.854	2026-06-16 11:34:02.856
c9109ea1-9fd8-4ec2-833e-8d9b521d139a	cc8da27e-4a59-474a-93fe-adfd1589382c	what is the vsiion	what is the vsiion	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-08 18:30:00	2026-06-16 18:29:59.999	# Team Performance Report\n\n**Summary**  \nNo activity recorded for this period.\n\n**Metrics**\n- Tasks: 0 total | 0 completed\n- Adhoc work: 0 entries | 0 hours\n- Work units: 0 open | 0 closed\n\n---\n\n*No tasks, adhoc work, or work units found for the selected timeframe.*	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-08T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 12:07:58.683	2026-06-16 11:57:58.684
9c9705d7-3958-4f8d-b8e4-5c5a6c68aebb	cc8da27e-4a59-474a-93fe-adfd1589382c	what is my vision	what is my vision	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-08 18:30:00	2026-06-16 18:29:59.999	# Your Vision: Admin Role at Masters' Union Creative Studio\n\n## Vision Alignment\n**Vision 27** positions Masters' Union as *the brand*, not just a content team inside a business school. The organization is scaling to **136 films, 20+ long-form videos/month, 15 new content initiatives, and a flagship 5,000-person event** — all while maintaining three core values: *Question Everything, Set the Bar High, Communicate Relentlessly*.\n\nAs **Admin**, you're the operational backbone enabling this 12-month sprint.\n\n---\n\n## Your Focus Now\n\n1. **Operational Infrastructure** — The vision lists 15+ initiatives (Project Bran, A-Team, Creators, OOH, Hyrox, etc.). You need to map:\n   - Who owns what? (Accountability matrix)\n   - What systems/tools do they need? (Project Bran goes live Aug 31—is it on track?)\n   - Where are bottlenecks? (Coverage team needs "zero backlog"—what's blocking them?)\n\n2. **Event Readiness** — October flagship event (5,000 people, "Mood Indigo scale"). This is the biggest test. You should own:\n   - Vendor coordination, timeline, risk register\n   - Cross-team comms (who's doing what content-wise?)\n\n3. **Hiring & Resourcing** — Vision calls for 136 films + 20 long-form videos/month. Are teams staffed? Route hiring requests through Neha; flag gaps early.\n\n---\n\n## Gaps / Opportunities\n\n- **No logged tasks/work units** — You have zero visibility into what's actually happening. This breaks the "Communicate, even when you don't have to" value. Start a weekly standup or task log *now*.\n- **Project Bran deadline (Aug 31)** — Is this tracked? If it slips, the whole org feels it.\n- **Event ownership unclear** — "Head of Events — incoming." Until they land, *you* may need to own interim planning.\n\n---\n\n## Next Steps\n\n1. **This week:** Schedule 1:1s with each initiative lead (Devansh, Ishika, Naveen, Ananya, Akash, etc.). Ask: "What do you need from ops to hit your targets?"\n2. **Create a master timeline** — All 15 initiatives, key milestones, dependencies.\n3. **Set up a weekly comms cadence** — Sync with Pratham Nagpal on blockers/wins.\n4. **Own the event** — Until Head of Events arrives, you're the coordinator.\n\n**Your role is to make Vision 27 *executable*. Start with visibility.**	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-08T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":3,"kpiCount":0,"guidanceQuery":true,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 12:36:54.323	2026-06-16 12:26:54.326
c6eaadcf-275f-48df-a0f4-cbd9447660ec	cc8da27e-4a59-474a-93fe-adfd1589382c	what is team's vision	what is team's vision	team	\N	Team	2026-06-08 18:30:00	2026-06-16 18:29:59.999	# Team Vision: Masters' Union Creative Studio FY 2026-27\n\n## **Vision Alignment**\nYour team is **the brand engine** for Masters' Union. You're not a support function—you're the creative studio driving three core mandates:\n\n1. **Content Factory** — 136 films, 20 long-form videos/month, 100 shorts/month, 250K LinkedIn followers by March 2027\n2. **Brand Authority** — OOH campaigns, flagship 5K-person event, universal brand narrative, AI-powered brand comms (Project Bran)\n3. **Student/Creator Ecosystem** — 10+ student creators at 10K+ followers, 2 YC acceptances, 30 competition wins\n\n**Core values:** Question everything. Set the bar uncomfortably high. Communicate proactively.\n\n---\n\n## **Focus Now**\nYour current work is **misaligned** with Vision 27 priorities. You're in website reviews and internal meetings—important, but not the north star.\n\n**Immediate priorities (next 30 days):**\n1. **Lock cadences** — YouTube TOFU/MOFU/BOFU channels need monthly-quarterly-yearly schedules (explicitly flagged as "yet to lock")\n2. **Project Bran launch** — Due Aug 31. This unblocks the entire org from repeated questions\n3. **Coverage factory** — Shashank's zero-backlog goal requires process clarity (DIT, turnaround SLAs)\n4. **Event infrastructure** — October flagship event (5K people) needs a lead + operational framework *now*\n\n---\n\n## **Gaps & Opportunities**\n- **You're doing:** Website QA, internal sync meetings\n- **You should be:** Shipping content at scale, building systems that reduce friction, launching Project Bran, defining event ops\n\nYour 4 open work units are operational/internal. Vision 27 demands external-facing output and systems that scale.\n\n---\n\n## **Next Steps**\n1. **Map your role** — Which Vision 27 pillar owns you? (Content, Brand, Events, Projects?)\n2. **Claim one metric** — Pick one KPI (e.g., "zero coverage backlog," "Project Bran live by Aug 31," "event ops framework")\n3. **Weekly sync with Pratham Nagpal** — Align on blockers preventing Vision 27 execution\n4. **Close the website work** — Finish by 2026-06-13, then redirect energy to vision-critical work\n\n**The bar is high. Make it count.**	{"user":{"id":null,"name":"team","memberCount":5},"scope":"team","timeRange":{"from":"2026-06-08T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":1,"workUnitCount":4,"visionCount":3,"kpiCount":0,"guidanceQuery":true,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 12:37:33.56	2026-06-16 12:27:33.562
56e415af-a6b0-4177-88c2-11e81baa4066	cc8da27e-4a59-474a-93fe-adfd1589382c	what is on my task list for today	what is on my task list for today	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-15 18:30:00	2026-06-16 18:29:59.999	# Team Performance Report\n\n## Summary\nNo tasks, adhoc work, or work units are currently assigned for today.	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-15T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 12:38:06.903	2026-06-16 12:28:06.905
7820f838-fcd3-4bab-9fd5-2e0c6d7dbb66	cc8da27e-4a59-474a-93fe-adfd1589382c	whats on my work list today	whats on my work list today	user	cc8da27e-4a59-474a-93fe-adfd1589382c	Admin	2026-06-15 18:30:00	2026-06-16 18:29:59.999	# Work List Report – Admin\n\n**Summary**  \nNo tasks, adhoc work, or work units are currently assigned for this period.\n\n**Next Steps**  \nYour work queue is clear. Consider reviewing upcoming priorities or backlog items to plan ahead.	{"user":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin"},"scope":"user","timeRange":{"from":"2026-06-15T18:30:00.000Z","to":"2026-06-16T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-16 12:39:16.661	2026-06-16 12:29:16.663
677ca234-e6fa-4e22-8a7c-23f5cff15182	de5dd353-4173-41b4-8f28-b372fd204c52	What did the team do this week?	what did the team do this week?	team	\N	Team	2026-06-14 18:30:00	2026-06-18 18:29:59.999	# Team Performance Report\n\n## Summary\nThe team logged minimal formal task activity this week, with 2 adhoc work entries (4.5 hours) and 11 open work units focused on meetings, planning, and coordination. One communication task was completed.\n\n## Highlights\n- Completed communication with IC stakeholders regarding pending matters\n- Logged adhoc work on brand initiatives (4.5 hours)\n- 11 active work units in progress covering performance reviews, event planning, reimbursement discussions, and brand onboarding\n\n## Metrics\n- **Adhoc work:** 2 entries, 4.5 hours total effort\n- **Work units:** 11 total (10 open, 1 closed)\n- **Formal tasks:** 0 logged this period\n\n## Concerns / Next Steps\nMultiple work units lack scheduled deadlines despite containing time-sensitive activities (performance reviews, vendor coordination, stakeholder calls). Recommend establishing explicit dates for: performance review meeting, Daisy brand update call, Divyam brand strategy discussion, and Dhananjay work assignment meeting to ensure accountability and momentum.	{"user":{"id":null,"name":"team","memberCount":5},"scope":"team","timeRange":{"from":"2026-06-14T18:30:00.000Z","to":"2026-06-18T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":2,"workUnitCount":11,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	2026-06-18 12:26:01.886	2026-06-18 12:16:01.888
58a25857-c337-4c88-b968-cc15efb7a1e8	de5dd353-4173-41b4-8f28-b372fd204c52	Yesterday Tasks?	yesterday tasks?	user	de5dd353-4173-41b4-8f28-b372fd204c52	Amisha Sharma	2026-06-16 18:30:00	2026-06-17 18:29:59.999	# Team Performance Report: Amisha Sharma\n\n**Summary**  \nNo activity logged for yesterday.\n\n**Metrics**\n- Tasks: 0 total | 0 completed\n- Adhoc work: 0 entries | 0 hours\n- Work units: 0 open, 0 closed	{"user":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma"},"scope":"user","timeRange":{"from":"2026-06-16T18:30:00.000Z","to":"2026-06-17T18:29:59.999Z"},"taskCount":0,"adhocWorkCount":0,"workUnitCount":0,"visionCount":0,"kpiCount":0,"guidanceQuery":false,"hadSemanticContext":false,"truncatedTasks":false,"truncatedAdhocWork":false,"truncatedWorkUnits":false}	f	\N	2026-06-18 12:17:08.266
\.


--
-- Data for Name: Content; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Content" (id, title, description, type, status, "teamId", "projectId", "createdById", "createdAt", "updatedAt") FROM stdin;
f5af171e-4572-4220-a36f-350261b988e3	TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt	testttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt	PRODUCTION	COMPLETED	70480e25-c097-4eaf-bf53-d1723f74380d	e13278aa-6c91-441d-9175-e02be38e35f7	de5dd353-4173-41b4-8f28-b372fd204c52	2026-06-09 06:53:24.805	2026-06-09 07:10:03.74
ea0f2ff9-a944-4359-ad21-676320ed25a9	EP SB Reel 1	asdsad dsadsa	PRODUCTION	IN_PROGRESS	70480e25-c097-4eaf-bf53-d1723f74380d	e13278aa-6c91-441d-9175-e02be38e35f7	cc8da27e-4a59-474a-93fe-adfd1589382c	2026-05-27 09:44:18.21	2026-06-09 09:08:13.727
eeffe489-420c-45fb-ba93-6a96590d9f3b	NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE	NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEENAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEENAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEENAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEENAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEENAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE	PRODUCTION	DRAFT	70480e25-c097-4eaf-bf53-d1723f74380d	e13278aa-6c91-441d-9175-e02be38e35f7	de5dd353-4173-41b4-8f28-b372fd204c52	2026-06-18 10:44:36.99	2026-06-18 10:45:49.204
\.


--
-- Data for Name: ContentNode; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentNode" (id, "contentId", kind, name, "orderIndex", status, notes, "startsAt", "dueDate", "completedAt", "createdAt", "updatedAt") FROM stdin;
bf952e50-ef30-4a8d-9865-f2943f432f4d	ea0f2ff9-a944-4359-ad21-676320ed25a9	SCRIPTING	Scripting	0	PENDING	\N	\N	\N	\N	2026-05-27 09:44:22.599	2026-05-27 09:44:22.599
78e85349-f03e-4274-9177-2f3ce744b644	ea0f2ff9-a944-4359-ad21-676320ed25a9	SHOOT	Shoot	1	PENDING	\N	\N	\N	\N	2026-05-27 09:44:26.282	2026-05-27 09:44:26.282
6f143385-ea77-4e03-ac39-e437c7180061	ea0f2ff9-a944-4359-ad21-676320ed25a9	EDITING	Editing	2	PENDING	\N	\N	\N	\N	2026-05-27 09:44:30.064	2026-05-27 09:44:30.064
d21494b4-22ff-48f7-b633-bfe7170e973a	ea0f2ff9-a944-4359-ad21-676320ed25a9	PUBLISHING	Test Pub	3	PENDING	\N	\N	\N	\N	2026-06-09 04:51:31.221	2026-06-09 04:51:31.221
0ce5e5de-9b74-437d-9f4a-583896a2cbbd	f5af171e-4572-4220-a36f-350261b988e3	SHOOT	TEST 2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222	1	PENDING	\N	2026-06-09 00:00:00	2026-06-29 00:00:00	\N	2026-06-09 07:11:12.87	2026-06-09 07:11:12.87
e2c1fa7c-78e6-441f-9192-9c6d792a5418	f5af171e-4572-4220-a36f-350261b988e3	BRIEF	TEST 3	2	PENDING	\N	\N	\N	\N	2026-06-09 07:11:30.605	2026-06-09 07:11:30.605
9c702e4a-1b2e-4815-a530-8db09c833789	f5af171e-4572-4220-a36f-350261b988e3	SCRIPTING	TEST 1	0	BLOCKED	\N	2026-06-09 00:00:00	2026-06-25 00:00:00	\N	2026-06-09 07:10:44.294	2026-06-09 08:05:46.313
4174d21f-41cc-4580-a03e-c5273de38805	eeffe489-420c-45fb-ba93-6a96590d9f3b	SHOOT	Shoot	1	PENDING	\N	\N	\N	\N	2026-06-18 10:44:38.448	2026-06-18 10:44:38.448
bcf1a2e7-47b1-4bd8-b86d-1c8e99270cb9	eeffe489-420c-45fb-ba93-6a96590d9f3b	EDITING	Editing	2	PENDING	\N	\N	\N	\N	2026-06-18 10:44:38.881	2026-06-18 10:44:38.881
4b1ab334-39c3-4fc2-bd31-d4f425696c3f	eeffe489-420c-45fb-ba93-6a96590d9f3b	PUBLISHING	Scripting	0	BLOCKED	Testtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt	\N	\N	\N	2026-06-18 10:44:37.925	2026-06-18 11:13:58.089
\.


--
-- Data for Name: ContentNodeOutput; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentNodeOutput" (id, "nodeId", label, url, notes, version, "submittedByUserId", "approvalState", "reviewNote", "reviewedByUserId", "reviewedAt", "createdAt", "updatedAt") FROM stdin;
cecf3ebe-bef8-49a1-b132-53b875b8af33	bf952e50-ef30-4a8d-9865-f2943f432f4d	Script v1	https://www.instagram.com/p/DYSMlZsJdJV/	sadsad asdsad	1	cc8da27e-4a59-474a-93fe-adfd1589382c	PENDING	\N	\N	\N	2026-05-27 09:46:14.639	2026-05-27 09:46:14.639
62f01da5-ee66-457f-9d38-4bcedb885220	d21494b4-22ff-48f7-b633-bfe7170e973a	Outpuut	https://clever-lizard-naming.cohesivity.app/work	\N	1	cc8da27e-4a59-474a-93fe-adfd1589382c	PENDING	\N	\N	\N	2026-06-09 04:54:47.42	2026-06-09 04:54:47.42
43abdfcc-9b50-47be-84a7-e9fb10a04c73	9c702e4a-1b2e-4815-a530-8db09c833789	LABEL 1	https://young-duck-lending.cohesivity.xyz/bengaluru	Check the noted of edit outputtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt	1	de5dd353-4173-41b4-8f28-b372fd204c52	APPROVED	rftugvhbgvfcdxsfcgvhbjnhbgvfcdxszdxfcgvhbjnknbhgvcfdxszadxfcgvhbjnkhbgvcfdxszdxfcgvhbjnkhbgvfcdhxszdxfcgvhbjnknbhgvcfdxsgzxfcgvhbjnknhbgvfjcdhxgszxfcgvbhjnkhgvfcdhxs vbnjkiuhygtfdcxvdxfcfgvhbgvhcfdxsfcgvhbgvcfdxsfcgv	de5dd353-4173-41b4-8f28-b372fd204c52	2026-06-09 08:08:11.112	2026-06-09 07:13:10.554	2026-06-09 08:08:11.113
608a9505-e280-4705-a29a-94d98b31200f	9c702e4a-1b2e-4815-a530-8db09c833789	TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT	https://young-duck-lending.cohesivity.xyz/bengaluru	\N	2	de5dd353-4173-41b4-8f28-b372fd204c52	IN_REVIEW	\N	\N	\N	2026-06-09 07:13:26.535	2026-06-09 08:08:11.141
3375d2d3-9e30-42e4-8607-6efe6f91e4e0	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	Test Labelllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll	https://young-duck-lending.cohesivity.xyz/bengaluru	Labelllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllll	1	de5dd353-4173-41b4-8f28-b372fd204c52	PENDING	\N	\N	\N	2026-06-18 10:48:47.976	2026-06-18 11:00:55.105
716da06b-08bb-4529-ac72-71b13c011329	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	Noteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee	https://young-duck-lending.cohesivity.xyz/bengaluru	eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee	2	de5dd353-4173-41b4-8f28-b372fd204c52	PENDING	\N	\N	\N	2026-06-18 11:04:06.347	2026-06-18 11:04:06.347
\.


--
-- Data for Name: ContentNodeResource; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentNodeResource" (id, "nodeId", name, "sourceType", cost, quantity, currency, notes, "approvalState", "reviewNote", "requestedByUserId", "reviewedByUserId", "reviewedAt", "createdAt", "updatedAt", "inventoryItemId") FROM stdin;
58aa5e81-4c0a-4bd1-a4ec-e586397fda1a	78e85349-f03e-4274-9177-2f3ce744b644	camera	IN_HOUSE	\N	5	\N	sadsa dasdsad	APPROVED	\N	cc8da27e-4a59-474a-93fe-adfd1589382c	\N	\N	2026-05-27 09:48:45.908	2026-05-27 09:48:45.908	\N
0e94fbb5-dc1c-4981-b0f8-8b3c2b72d999	78e85349-f03e-4274-9177-2f3ce744b644	Tubelighty	RENTAL	20000.00	1	INR	sdsad asdsad	PENDING	\N	cc8da27e-4a59-474a-93fe-adfd1589382c	\N	\N	2026-05-27 09:49:39.197	2026-05-27 09:49:39.197	\N
8b3c95cf-8169-4872-896b-503b7a275f18	bf952e50-ef30-4a8d-9865-f2943f432f4d	Camera	RENTAL	40000.00	1	INR	\N	PENDING	\N	cc8da27e-4a59-474a-93fe-adfd1589382c	\N	\N	2026-05-29 11:25:28.332	2026-05-29 11:25:28.332	\N
1cf8af20-2743-4582-8168-f78f7b1e79cf	d21494b4-22ff-48f7-b633-bfe7170e973a	Camera	IN_HOUSE	\N	1	\N	\N	APPROVED	\N	cc8da27e-4a59-474a-93fe-adfd1589382c	\N	\N	2026-06-09 04:56:55.267	2026-06-09 04:56:55.267	\N
711904cf-6f19-49a6-a6a7-1e6b986cba15	d21494b4-22ff-48f7-b633-bfe7170e973a	Car	RENTAL	200000.00	2	INR	\N	PENDING	\N	cc8da27e-4a59-474a-93fe-adfd1589382c	\N	\N	2026-06-09 04:57:25.348	2026-06-09 04:57:25.348	\N
13239a0d-5e02-4e7a-bee3-fd44dc7a1ed5	9c702e4a-1b2e-4815-a530-8db09c833789	Camera Stand	IN_HOUSE	\N	6	\N	Please checkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk	APPROVED	\N	de5dd353-4173-41b4-8f28-b372fd204c52	\N	\N	2026-06-09 07:30:25.445	2026-06-09 07:30:25.445	\N
75433f7e-8ced-45cf-ac67-6a8696deea44	9c702e4a-1b2e-4815-a530-8db09c833789	Car	RENTAL	200000.00	4	INR	\N	APPROVED	\N	de5dd353-4173-41b4-8f28-b372fd204c52	de5dd353-4173-41b4-8f28-b372fd204c52	2026-06-09 08:02:50.326	2026-06-09 07:27:12.667	2026-06-09 08:02:50.327	\N
1290d272-6a74-4578-8289-82e80f99718c	e2c1fa7c-78e6-441f-9192-9c6d792a5418	Carsssssssss	RENTAL	100000.00	1	INR	\N	PENDING	\N	de5dd353-4173-41b4-8f28-b372fd204c52	\N	\N	2026-06-11 07:15:46.389	2026-06-11 07:15:46.389	\N
080f2789-927b-470a-842c-f14d2c4a6d13	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	testt c	RENTAL	200000.00	1	INR	\N	PENDING	\N	de5dd353-4173-41b4-8f28-b372fd204c52	\N	\N	2026-06-18 11:02:01.032	2026-06-18 11:02:01.032	\N
dfa95f9f-27ea-45de-9cb6-a6da219f4dda	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	Cameraaaaaaaaaaaaaaa	RENTAL	23333333.00	2	INR	\N	APPROVED	\N	de5dd353-4173-41b4-8f28-b372fd204c52	de5dd353-4173-41b4-8f28-b372fd204c52	2026-06-18 11:11:12.456	2026-06-18 11:11:07.478	2026-06-18 11:11:12.457	\N
96e5707a-59a2-44e1-adf8-16b5b8b02103	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	Lamp	IN_HOUSE	\N	1	\N	\N	APPROVED	\N	de5dd353-4173-41b4-8f28-b372fd204c52	\N	\N	2026-06-18 11:12:33.512	2026-06-18 11:12:33.512	\N
\.


--
-- Data for Name: ContentNodeTeamMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ContentNodeTeamMember" (id, "nodeId", "userId", role, "createdAt") FROM stdin;
b47b2914-25c6-4ad2-b69f-6a28bed10ba9	bf952e50-ef30-4a8d-9865-f2943f432f4d	de5dd353-4173-41b4-8f28-b372fd204c52	SCRIPTER	2026-05-27 09:45:40.921
e3b4617f-38ac-4794-a970-173bd800a826	bf952e50-ef30-4a8d-9865-f2943f432f4d	cc8da27e-4a59-474a-93fe-adfd1589382c	DIRECTOR	2026-05-27 09:45:53.494
4724202a-374c-4a65-be7b-329918767af2	78e85349-f03e-4274-9177-2f3ce744b644	058c404a-165c-4ccc-a0d4-eacf23950652	DOP	2026-05-27 09:47:48.16
265749fe-5a1f-4278-982c-0fdfa9d7bd24	d21494b4-22ff-48f7-b633-bfe7170e973a	de5dd353-4173-41b4-8f28-b372fd204c52	EDITOR	2026-06-09 04:56:00.533
05240407-5c62-4e82-baac-52cf22089f64	d21494b4-22ff-48f7-b633-bfe7170e973a	058c404a-165c-4ccc-a0d4-eacf23950652	ACTOR	2026-06-09 04:56:16.291
68e37f0b-75d9-4366-a9f1-45d421b4967e	4b1ab334-39c3-4fc2-bd31-d4f425696c3f	de5dd353-4173-41b4-8f28-b372fd204c52	SCRIPTER	2026-06-18 10:53:10.521
\.


--
-- Data for Name: Idea; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Idea" (id, "authorId", title, description, tags, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: IdeaMatch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."IdeaMatch" (id, "ideaId", "candidateIdeaId", "matchedUserId", score, status, "notifiedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InstagramPerformance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InstagramPerformance" (id, source, "sourceItemId", language, "mentionCount", "estimatedViews", "estimatedReach", engagement, "engagementCount", "engagementRate", sentiment, "mentionedAt", "rawPayload", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InventoryItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryItem" (id, name, description, category, "serialNumber", status, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: InventoryItemTeam; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryItemTeam" ("inventoryItemId", "teamId", "isPrimary", "assignedAt") FROM stdin;
\.


--
-- Data for Name: InventoryReservation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryReservation" (id, "inventoryItemId", "contentNodeId", "contentNodeResourceId", "reservedFrom", "dueBackAt", "returnedAt", status, notes, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: NavSearchLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."NavSearchLog" (id, "userId", query, "selectedPath", "createdAt") FROM stdin;
a678bd18-26ed-4d55-afaa-b6e6c1b3f444	cc8da27e-4a59-474a-93fe-adfd1589382c	vis	/visions	2026-06-16 10:55:17.345
5bc66ad7-cf83-4f70-ab01-94faff075ca9	cc8da27e-4a59-474a-93fe-adfd1589382c	ai	/ai	2026-06-16 10:56:53.078
0482fa96-4778-4f0d-a8c4-7cf35b1c86ca	cc8da27e-4a59-474a-93fe-adfd1589382c	work	/work	2026-06-16 11:01:07.518
c09ddc00-6a07-4735-8a5d-85f38e8e5524	cc8da27e-4a59-474a-93fe-adfd1589382c	ai	/ai	2026-06-16 11:29:12.329
c3f64630-1ae8-4e52-a2b1-98fb9120cff8	cc8da27e-4a59-474a-93fe-adfd1589382c	vi	/visions	2026-06-16 12:26:10.921
21d15fb0-5401-4cab-aaca-53a64988212a	cc8da27e-4a59-474a-93fe-adfd1589382c	shoot	/contents	2026-06-18 11:01:22.824
e93b9002-9a04-4be7-bbe6-e83d80e18119	9f2ddc40-b560-4b23-9393-d227cf4a03af	work	/work	2026-06-19 09:20:52.156
be9f405e-5080-429c-9735-5a95f71dfd53	9f2ddc40-b560-4b23-9393-d227cf4a03af	work	/work	2026-06-19 09:22:15.175
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", kind, title, body, data, "dedupeKey", "readAt", "emailSentAt", "createdAt") FROM stdin;
5fa2965f-8bd4-4aec-ac5d-9e97d56a11d1	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "EP SB Reel 1" (Non Fiction)	Approval needed for "Tubelighty" (INR 20000) on "EP SB Reel 1" — node "Shoot".	{"contentId":"ea0f2ff9-a944-4359-ad21-676320ed25a9","contentTitle":"EP SB Reel 1","verticalName":"Non Fiction","node":{"id":"78e85349-f03e-4274-9177-2f3ce744b644","name":"Shoot","kind":"SHOOT","orderIndex":1},"resource":{"id":"0e94fbb5-dc1c-4981-b0f8-8b3c2b72d999","name":"Tubelighty","sourceType":"RENTAL","cost":"20000","currency":"INR","quantity":1,"notes":"sdsad asdsad"},"requestedBy":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin","email":"admin@bran.app"}}	content_resource_requested:0e94fbb5-dc1c-4981-b0f8-8b3c2b72d999	\N	\N	2026-05-27 09:49:42.649
b7a13a4f-9df8-4ae0-995f-3bab4bcf3aa0	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "EP SB Reel 1" (Non Fiction)	Approval needed for "Camera" (INR 40000) on "EP SB Reel 1" — node "Scripting".	{"contentId":"ea0f2ff9-a944-4359-ad21-676320ed25a9","contentTitle":"EP SB Reel 1","verticalName":"Non Fiction","node":{"id":"bf952e50-ef30-4a8d-9865-f2943f432f4d","name":"Scripting","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"8b3c95cf-8169-4872-896b-503b7a275f18","name":"Camera","sourceType":"RENTAL","cost":"40000","currency":"INR","quantity":1,"notes":null},"requestedBy":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin","email":"admin@bran.app"},"link":"http://localhost:3000/contents/ea0f2ff9-a944-4359-ad21-676320ed25a9?nodeId=bf952e50-ef30-4a8d-9865-f2943f432f4d"}	content_resource_requested:8b3c95cf-8169-4872-896b-503b7a275f18	\N	\N	2026-05-29 11:25:38.105
b8637b33-297f-49ba-9978-66b6905ac398	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "EP SB Reel 1" (Non Fiction)	Approval needed for "Car" (INR 200000) on "EP SB Reel 1" — node "Test Pub".	{"contentId":"ea0f2ff9-a944-4359-ad21-676320ed25a9","contentTitle":"EP SB Reel 1","verticalName":"Non Fiction","node":{"id":"d21494b4-22ff-48f7-b633-bfe7170e973a","name":"Test Pub","kind":"PUBLISHING","orderIndex":3},"resource":{"id":"711904cf-6f19-49a6-a6a7-1e6b986cba15","name":"Car","sourceType":"RENTAL","cost":"200000","currency":"INR","quantity":2,"notes":null},"requestedBy":{"id":"cc8da27e-4a59-474a-93fe-adfd1589382c","name":"Admin","email":"admin@bran.app"}}	content_resource_requested:711904cf-6f19-49a6-a6a7-1e6b986cba15	\N	\N	2026-06-09 04:57:33.654
7afd231a-aeb8-43b7-94b9-a6fc9cbc31c2	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt" (Non Fiction)	Approval needed for "Car" (INR 200000) on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt" — node "TEST 1".	{"contentId":"f5af171e-4572-4220-a36f-350261b988e3","contentTitle":"TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt","verticalName":"Non Fiction","node":{"id":"9c702e4a-1b2e-4815-a530-8db09c833789","name":"TEST 1","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"75433f7e-8ced-45cf-ac67-6a8696deea44","name":"Car","sourceType":"RENTAL","cost":"200000","currency":"INR","quantity":4,"notes":null},"requestedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_requested:75433f7e-8ced-45cf-ac67-6a8696deea44	\N	\N	2026-06-09 07:27:12.731
d74f00e2-6d56-4887-84bc-7f1c336b8f9d	de5dd353-4173-41b4-8f28-b372fd204c52	CONTENT_NODE_READY	TEST 1 approved — TEST 2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222 is ready to start	"TEST 1" approved on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt". Your next step "TEST 2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222" is ready.	{"contentId":"f5af171e-4572-4220-a36f-350261b988e3","contentTitle":"TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt","fromNode":{"id":"9c702e4a-1b2e-4815-a530-8db09c833789","name":"TEST 1","kind":"SCRIPTING","orderIndex":0},"toNode":{"id":"0ce5e5de-9b74-437d-9f4a-583896a2cbbd","name":"TEST 2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222","kind":"SHOOT","orderIndex":1},"approvedOutput":{"id":"608a9505-e280-4705-a29a-94d98b31200f","label":"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT","url":"https://young-duck-lending.cohesivity.xyz/bengaluru","notes":null,"version":2,"reviewedAt":"2026-06-09T07:17:33.502Z","approvalState":"APPROVED","reviewedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"},"submittedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}}	content_node_ready:9c702e4a-1b2e-4815-a530-8db09c833789:608a9505-e280-4705-a29a-94d98b31200f	2026-06-09 08:15:12.719	\N	2026-06-09 08:04:37.398
36f3b2f0-75e3-4085-bb7c-9fdf989dca12	de5dd353-4173-41b4-8f28-b372fd204c52	CONTENT_RESOURCE_REVIEWED	Rental resource approved: "Car" on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt"	"Car" was approved on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt" — node "TEST 1".	{"contentId":"f5af171e-4572-4220-a36f-350261b988e3","contentTitle":"TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt","node":{"id":"9c702e4a-1b2e-4815-a530-8db09c833789","name":"TEST 1","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"75433f7e-8ced-45cf-ac67-6a8696deea44","name":"Car","sourceType":"RENTAL","cost":"200000","currency":"INR","quantity":4,"notes":null,"approvalState":"APPROVED","reviewNote":null},"reviewedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_reviewed:75433f7e-8ced-45cf-ac67-6a8696deea44:APPROVED	2026-06-09 08:15:12.719	\N	2026-06-09 08:02:50.408
b74031f8-4ec1-4d8a-b962-f8bfe9225a82	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt" (Non Fiction)	Approval needed for "Carsssssssss" (INR 100000) on "TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt" — node "TEST 3".	{"contentId":"f5af171e-4572-4220-a36f-350261b988e3","contentTitle":"TEST CONTENTtttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt","verticalName":"Non Fiction","node":{"id":"e2c1fa7c-78e6-441f-9192-9c6d792a5418","name":"TEST 3","kind":"BRIEF","orderIndex":2},"resource":{"id":"1290d272-6a74-4578-8289-82e80f99718c","name":"Carsssssssss","sourceType":"RENTAL","cost":"100000","currency":"INR","quantity":1,"notes":null},"requestedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_requested:1290d272-6a74-4578-8289-82e80f99718c	\N	\N	2026-06-11 07:15:46.542
8d6c41fa-4d96-415b-931a-8abf4e9ce2e1	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE" (Non Fiction)	Approval needed for "testt c" (INR 200000) on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE" — node "Scripting".	{"contentId":"eeffe489-420c-45fb-ba93-6a96590d9f3b","contentTitle":"NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","verticalName":"Non Fiction","node":{"id":"4b1ab334-39c3-4fc2-bd31-d4f425696c3f","name":"Scripting","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"080f2789-927b-470a-842c-f14d2c4a6d13","name":"testt c","sourceType":"RENTAL","cost":"200000","currency":"INR","quantity":1,"notes":null},"requestedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_requested:080f2789-927b-470a-842c-f14d2c4a6d13	\N	\N	2026-06-18 11:02:01.155
c30764dd-7e78-416a-b487-7c899abac952	cc8da27e-4a59-474a-93fe-adfd1589382c	CONTENT_RESOURCE_REQUESTED	Approval needed: rental resource on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE" (Non Fiction)	Approval needed for "Cameraaaaaaaaaaaaaaa" (INR 23333333) on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE" — node "Scripting".	{"contentId":"eeffe489-420c-45fb-ba93-6a96590d9f3b","contentTitle":"NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","verticalName":"Non Fiction","node":{"id":"4b1ab334-39c3-4fc2-bd31-d4f425696c3f","name":"Scripting","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"dfa95f9f-27ea-45de-9cb6-a6da219f4dda","name":"Cameraaaaaaaaaaaaaaa","sourceType":"RENTAL","cost":"23333333","currency":"INR","quantity":2,"notes":null},"requestedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_requested:dfa95f9f-27ea-45de-9cb6-a6da219f4dda	\N	\N	2026-06-18 11:11:07.581
c72b96bf-5cdc-4de2-9f0a-c841a3394526	de5dd353-4173-41b4-8f28-b372fd204c52	CONTENT_RESOURCE_REVIEWED	Rental resource approved: "Cameraaaaaaaaaaaaaaa" on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"	"Cameraaaaaaaaaaaaaaa" was approved on "NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE" — node "Scripting".	{"contentId":"eeffe489-420c-45fb-ba93-6a96590d9f3b","contentTitle":"NAMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE","node":{"id":"4b1ab334-39c3-4fc2-bd31-d4f425696c3f","name":"Scripting","kind":"SCRIPTING","orderIndex":0},"resource":{"id":"dfa95f9f-27ea-45de-9cb6-a6da219f4dda","name":"Cameraaaaaaaaaaaaaaa","sourceType":"RENTAL","cost":"23333333","currency":"INR","quantity":2,"notes":null,"approvalState":"APPROVED","reviewNote":null},"reviewedBy":{"id":"de5dd353-4173-41b4-8f28-b372fd204c52","name":"Amisha Sharma","email":"amisha.sharma@mastersunion.org"}}	content_resource_reviewed:dfa95f9f-27ea-45de-9cb6-a6da219f4dda:APPROVED	2026-06-18 11:26:09.646	\N	2026-06-18 11:11:12.569
\.


--
-- Data for Name: Permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Permission" (id, name, description) FROM stdin;
9d29f387-6a3d-495e-bfcd-2c311bde7bce	manage_users	Create, update, and delete users
eafe9e6f-60fe-4763-8c75-63c062ae09fa	manage_roles	Create, update, and delete roles and permissions
c56ee818-0abb-4b96-a6a5-5ecb72600ae4	view_reports	View performance reports and analytics
b1a7fb96-c2b8-438f-bc5f-7706e171c937	create_tasks	Create new tasks
b3ff8feb-ceb4-44c3-adec-72c6f7514d6f	manage_tasks	Update and delete any task
e6a78b14-68de-441f-98ab-e4ab9061a459	query_ai	Use the AI query interface for performance reports
8777de95-9e1d-47a7-b750-89d22a7f07d8	view_all_tasks	View tasks of all users
618ca3c1-4f30-4f55-8d77-a0059ac8b03d	manage_adhoc_work	Log and manage adhoc work outside content work units
c8e72866-3f57-43bd-ba52-731312aff6e2	manage_social_accounts	Link and unlink social accounts for any user
4b9e9151-1591-4b6d-9c0c-6a48e5ecb3f9	manage_teams	Create and manage permanent teams and hierarchy
3f9469d5-b9ef-4771-ac81-ff5790cd0e42	manage_projects	Create and manage project teams and hierarchy
0025e3d6-0b77-412a-8fff-ad1ab12b0460	manage_verticals	Manage verticals and reassign vertical owners
730e86b3-3cec-43cf-a4c7-f2bc57e0a5ff	manage_content	Create and manage Content, nodes, team, outputs, and resources
a2fdd16d-cdb3-4727-8364-97433910c197	approve_resources	Approve / reject Content node outputs
5ab30e6f-5427-4c26-a517-9cc41ab36f91	manage_ideation	Create ideas and view collaborator recommendations
78d34db2-444f-4bc9-a0d9-23a3efb4ed1a	approve_rental_resources	Approve / reject rental resource requests on content nodes (vertical heads + admins)
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Project" (id, name, description, objectives, "finalLink", "verticalId", "createdById", status, "startsAt", "endsAt", "createdAt", "updatedAt") FROM stdin;
e13278aa-6c91-441d-9175-e02be38e35f7	EP Sabeer Bhatia	dsadsa dasd	\N	\N	a3b867ed-6dd9-4593-a67e-5aebfd9efbc4	cc8da27e-4a59-474a-93fe-adfd1589382c	ACTIVE	\N	\N	2026-05-27 09:43:02.47	2026-05-27 09:43:02.47
\.


--
-- Data for Name: ProjectMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProjectMember" (id, "projectId", "userId", "memberRole", "reportsToUserId", "joinedAt", "isActive") FROM stdin;
\.


--
-- Data for Name: ProjectPhase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ProjectPhase" (id, "projectId", name, objectives, deadline, status, "orderIndex", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Role" (id, name, description, "createdAt", "updatedAt") FROM stdin;
64ba3ddf-da78-4b96-83c1-50f8767c990f	superadmin	Super Admin with full access including vertical owner reassignment	2026-05-26 10:50:52.62	2026-06-16 08:17:16.839
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	admin	Full system access	2026-05-26 10:50:55.81	2026-06-16 08:17:18.99
ca125dfd-807e-474e-b134-5408796ced11	chief_of_staff	Chief Of Staff with admin-level access	2026-05-26 10:50:58.201	2026-06-16 08:17:20.484
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	manager	Can view reports, query AI, and manage tasks	2026-05-26 10:51:00.184	2026-06-16 08:17:21.746
180351d0-cf5f-4041-a0cd-cc457d307c20	content_creator	Can create and manage own tasks and query AI	2026-05-26 10:51:02.948	2026-06-16 08:17:23.27
\.


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RolePermission" ("roleId", "permissionId") FROM stdin;
64ba3ddf-da78-4b96-83c1-50f8767c990f	9d29f387-6a3d-495e-bfcd-2c311bde7bce
64ba3ddf-da78-4b96-83c1-50f8767c990f	eafe9e6f-60fe-4763-8c75-63c062ae09fa
64ba3ddf-da78-4b96-83c1-50f8767c990f	c56ee818-0abb-4b96-a6a5-5ecb72600ae4
64ba3ddf-da78-4b96-83c1-50f8767c990f	b1a7fb96-c2b8-438f-bc5f-7706e171c937
64ba3ddf-da78-4b96-83c1-50f8767c990f	b3ff8feb-ceb4-44c3-adec-72c6f7514d6f
64ba3ddf-da78-4b96-83c1-50f8767c990f	e6a78b14-68de-441f-98ab-e4ab9061a459
64ba3ddf-da78-4b96-83c1-50f8767c990f	8777de95-9e1d-47a7-b750-89d22a7f07d8
64ba3ddf-da78-4b96-83c1-50f8767c990f	c8e72866-3f57-43bd-ba52-731312aff6e2
64ba3ddf-da78-4b96-83c1-50f8767c990f	4b9e9151-1591-4b6d-9c0c-6a48e5ecb3f9
64ba3ddf-da78-4b96-83c1-50f8767c990f	3f9469d5-b9ef-4771-ac81-ff5790cd0e42
64ba3ddf-da78-4b96-83c1-50f8767c990f	0025e3d6-0b77-412a-8fff-ad1ab12b0460
64ba3ddf-da78-4b96-83c1-50f8767c990f	730e86b3-3cec-43cf-a4c7-f2bc57e0a5ff
64ba3ddf-da78-4b96-83c1-50f8767c990f	a2fdd16d-cdb3-4727-8364-97433910c197
64ba3ddf-da78-4b96-83c1-50f8767c990f	5ab30e6f-5427-4c26-a517-9cc41ab36f91
64ba3ddf-da78-4b96-83c1-50f8767c990f	78d34db2-444f-4bc9-a0d9-23a3efb4ed1a
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	9d29f387-6a3d-495e-bfcd-2c311bde7bce
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	eafe9e6f-60fe-4763-8c75-63c062ae09fa
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	c56ee818-0abb-4b96-a6a5-5ecb72600ae4
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	b1a7fb96-c2b8-438f-bc5f-7706e171c937
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	b3ff8feb-ceb4-44c3-adec-72c6f7514d6f
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	e6a78b14-68de-441f-98ab-e4ab9061a459
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	8777de95-9e1d-47a7-b750-89d22a7f07d8
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	c8e72866-3f57-43bd-ba52-731312aff6e2
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	4b9e9151-1591-4b6d-9c0c-6a48e5ecb3f9
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	3f9469d5-b9ef-4771-ac81-ff5790cd0e42
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	730e86b3-3cec-43cf-a4c7-f2bc57e0a5ff
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	a2fdd16d-cdb3-4727-8364-97433910c197
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	5ab30e6f-5427-4c26-a517-9cc41ab36f91
15d2f42b-a4f1-4d62-9c6f-48c4b2692492	78d34db2-444f-4bc9-a0d9-23a3efb4ed1a
ca125dfd-807e-474e-b134-5408796ced11	9d29f387-6a3d-495e-bfcd-2c311bde7bce
ca125dfd-807e-474e-b134-5408796ced11	eafe9e6f-60fe-4763-8c75-63c062ae09fa
ca125dfd-807e-474e-b134-5408796ced11	c56ee818-0abb-4b96-a6a5-5ecb72600ae4
ca125dfd-807e-474e-b134-5408796ced11	b1a7fb96-c2b8-438f-bc5f-7706e171c937
ca125dfd-807e-474e-b134-5408796ced11	b3ff8feb-ceb4-44c3-adec-72c6f7514d6f
ca125dfd-807e-474e-b134-5408796ced11	e6a78b14-68de-441f-98ab-e4ab9061a459
ca125dfd-807e-474e-b134-5408796ced11	8777de95-9e1d-47a7-b750-89d22a7f07d8
ca125dfd-807e-474e-b134-5408796ced11	c8e72866-3f57-43bd-ba52-731312aff6e2
ca125dfd-807e-474e-b134-5408796ced11	4b9e9151-1591-4b6d-9c0c-6a48e5ecb3f9
ca125dfd-807e-474e-b134-5408796ced11	3f9469d5-b9ef-4771-ac81-ff5790cd0e42
ca125dfd-807e-474e-b134-5408796ced11	730e86b3-3cec-43cf-a4c7-f2bc57e0a5ff
ca125dfd-807e-474e-b134-5408796ced11	a2fdd16d-cdb3-4727-8364-97433910c197
ca125dfd-807e-474e-b134-5408796ced11	5ab30e6f-5427-4c26-a517-9cc41ab36f91
ca125dfd-807e-474e-b134-5408796ced11	78d34db2-444f-4bc9-a0d9-23a3efb4ed1a
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	c56ee818-0abb-4b96-a6a5-5ecb72600ae4
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	b1a7fb96-c2b8-438f-bc5f-7706e171c937
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	b3ff8feb-ceb4-44c3-adec-72c6f7514d6f
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	e6a78b14-68de-441f-98ab-e4ab9061a459
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	8777de95-9e1d-47a7-b750-89d22a7f07d8
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	c8e72866-3f57-43bd-ba52-731312aff6e2
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	4b9e9151-1591-4b6d-9c0c-6a48e5ecb3f9
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	3f9469d5-b9ef-4771-ac81-ff5790cd0e42
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	730e86b3-3cec-43cf-a4c7-f2bc57e0a5ff
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	a2fdd16d-cdb3-4727-8364-97433910c197
2fa1db17-adf4-4f0c-947c-55c9d2ac3421	5ab30e6f-5427-4c26-a517-9cc41ab36f91
180351d0-cf5f-4041-a0cd-cc457d307c20	b1a7fb96-c2b8-438f-bc5f-7706e171c937
180351d0-cf5f-4041-a0cd-cc457d307c20	5ab30e6f-5427-4c26-a517-9cc41ab36f91
180351d0-cf5f-4041-a0cd-cc457d307c20	e6a78b14-68de-441f-98ab-e4ab9061a459
180351d0-cf5f-4041-a0cd-cc457d307c20	c56ee818-0abb-4b96-a6a5-5ecb72600ae4
\.


--
-- Data for Name: SocialAccount; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SocialAccount" (id, "userId", platform, "platformAccountId", handle, "createdAt") FROM stdin;
908084c6-f897-423b-826b-a6716a635aa8	de5dd353-4173-41b4-8f28-b372fd204c52	INSTAGRAM	elevatorpitch.my	\N	2026-05-27 07:34:39.506
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Task" (id, "userId", title, description, type, platform, "contentUrl", status, metadata, "dueDate", "completedAt", "createdAt", "updatedAt") FROM stdin;
4370c8e6-2ba2-4891-9121-8ac52a8cf597	cc8da27e-4a59-474a-93fe-adfd1589382c	Elevator Pitch Varun Cortex	\N	CONTENT_CREATION	INSTAGRAM	\N	PENDING	\N	2026-05-28 09:37:00	\N	2026-05-27 09:37:37.077	2026-05-27 09:37:37.077
e9345841-d2b4-44ae-ab4c-6f7538d0fbde	cc8da27e-4a59-474a-93fe-adfd1589382c	Test Video	sadsadnsadasdsa	CONTENT_CREATION	INSTAGRAM	https://www.instagram.com/p/DYSMlZsJdJV/	PENDING	{"instagramStatsError":"Apify request failed (401): {\\n  \\"error\\": {\\n    \\"type\\": \\"user-or-token-not-found\\",\\n    \\"message\\": \\"User was not found or authentication token is not valid\\"\\n  }\\n}"}	\N	\N	2026-05-27 09:38:35.03	2026-05-27 09:38:35.03
\.


--
-- Data for Name: Team; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Team" (id, name, description, "verticalId", "createdById", "isActive", "createdAt", "updatedAt") FROM stdin;
70480e25-c097-4eaf-bf53-d1723f74380d	Elevator Pitch	\N	a3b867ed-6dd9-4593-a67e-5aebfd9efbc4	cc8da27e-4a59-474a-93fe-adfd1589382c	t	2026-05-27 09:40:38.699	2026-05-27 09:41:51.807
\.


--
-- Data for Name: TeamMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TeamMember" (id, "teamId", "userId", "memberRole", "reportsToUserId", "joinedAt", "isActive") FROM stdin;
cf0299c5-88bd-4586-9a01-6d7a6ddb3d86	70480e25-c097-4eaf-bf53-d1723f74380d	058c404a-165c-4ccc-a0d4-eacf23950652	MEMBER	\N	2026-05-27 09:41:51.815	t
dde1239e-225d-4b3e-a327-32b66e2f94c2	70480e25-c097-4eaf-bf53-d1723f74380d	de5dd353-4173-41b4-8f28-b372fd204c52	MEMBER	058c404a-165c-4ccc-a0d4-eacf23950652	2026-05-27 09:41:51.824	t
bcd61938-05f1-468c-8d4d-fa69b0586a6c	70480e25-c097-4eaf-bf53-d1723f74380d	cc8da27e-4a59-474a-93fe-adfd1589382c	MEMBER	058c404a-165c-4ccc-a0d4-eacf23950652	2026-05-27 09:41:51.829	t
\.


--
-- Data for Name: ThumbnailGeneration; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ThumbnailGeneration" (id, "userId", "inputTitle", "inputDescription", "inputContext", "referencePaths", "outputTitle", "outputTextDescription", "outputContext", assets, "designBrief", "styleFromReferences", "generatedImagePath", "generatedMimeType", "generatedFileSizeBytes", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "googleId", email, name, "avatarUrl", description, phone, designation, "passwordHash", "roleId", "isActive", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
058c404a-165c-4ccc-a0d4-eacf23950652	110211635949184946656	sudeep.purwar@mastersunion.org	Sudeep Purwar	https://lh3.googleusercontent.com/a/ACg8ocIyzr3jD9SqmWPcJHboW7huel2ZVIDGL_swNyGaxAXWIcDQmw=s96-c	\N	\N	\N	\N	180351d0-cf5f-4041-a0cd-cc457d307c20	t	2026-06-16 09:53:42.473	2026-05-26 10:51:55.725	2026-06-16 09:53:42.474
de5dd353-4173-41b4-8f28-b372fd204c52	103506421463738399461	amisha.sharma@mastersunion.org	Amisha Sharma	https://lh3.googleusercontent.com/a/ACg8ocIX9vOsPf1-X-TH9uD5DrUol48dudcrpATczFO2YsdQ3jsPRw=s96-c		334	Test	\N	15d2f42b-a4f1-4d62-9c6f-48c4b2692492	t	2026-06-16 15:40:25.191	2026-05-26 15:42:19.905	2026-06-16 15:40:25.192
b5026f0a-0d72-40bd-b28a-e4b86af109bb	101089002597508747504	dhananjay.jain@mastersunion.org	Dhananjay Jain	https://lh3.googleusercontent.com/a/ACg8ocLB8K1cbvsu-bQILO2u3Mgx_JOuN625UI-wydzNDAphYd3wJA=s96-c	\N	\N	\N	\N	15d2f42b-a4f1-4d62-9c6f-48c4b2692492	t	2026-06-17 08:26:44.426	2026-06-16 08:17:33.372	2026-06-17 08:26:44.427
cc8da27e-4a59-474a-93fe-adfd1589382c	\N	admin@bran.app	Admin	\N	\N	\N	\N	$2b$12$iZAkRRVtAFpKu0EOrXfJX.lZbCqzyEz7F4beV/w9PcQ9yvJl15Nbe	15d2f42b-a4f1-4d62-9c6f-48c4b2692492	t	2026-06-18 10:36:36.67	2026-05-26 10:51:05.901	2026-06-18 10:36:36.671
9f2ddc40-b560-4b23-9393-d227cf4a03af	107390006431017907606	arun.rengaswamy@mastersunion.org	Arun Rengaswamy	https://lh3.googleusercontent.com/a/ACg8ocJip3vyP4fpVH254lnUaNeqBFbj9d14bUdg1-eIToLItBUVhA=s96-c	\N	\N	\N	\N	15d2f42b-a4f1-4d62-9c6f-48c4b2692492	t	2026-06-18 13:58:00.11	2026-06-09 09:57:16.103	2026-06-18 13:58:00.111
\.


--
-- Data for Name: UserKpi; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserKpi" (id, "userId", title, description, "sortOrder", "isActive", "createdById", "createdAt", "updatedAt", "isKey") FROM stdin;
\.


--
-- Data for Name: UserPageVisit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserPageVisit" (id, "userId", path, "visitCount", "lastVisitedAt", "createdAt", "updatedAt") FROM stdin;
7a6edb3f-d544-4b4a-96d5-d97599a1ff44	058c404a-165c-4ccc-a0d4-eacf23950652	/visions	1	2026-06-16 10:39:27.624	2026-06-16 10:39:27.626	2026-06-16 10:39:27.626
022a1899-820f-48aa-9f12-4573e93ee008	cc8da27e-4a59-474a-93fe-adfd1589382c	/tasks	2	2026-06-19 10:22:45.927	2026-06-19 09:28:36.154	2026-06-19 10:22:45.928
6c6eeac0-133f-4d25-8eab-e9d0c2c674ae	cc8da27e-4a59-474a-93fe-adfd1589382c	/teams	1	2026-06-18 10:05:41.045	2026-06-18 10:05:41.046	2026-06-18 10:05:41.046
81428088-e58f-44d5-8efc-8cbc6537c946	cc8da27e-4a59-474a-93fe-adfd1589382c	/contents	7	2026-06-19 10:23:37.54	2026-06-18 10:07:06.614	2026-06-19 10:23:37.541
f8106d6d-d4a3-4731-830c-bf56f8864411	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/contents	1	2026-06-18 10:12:55.121	2026-06-18 10:12:55.123	2026-06-18 10:12:55.123
850ac3ce-82f0-4d71-b61c-464f3365746a	cc8da27e-4a59-474a-93fe-adfd1589382c	/contents/ea0f2ff9-a944-4359-ad21-676320ed25a9	5	2026-06-19 10:23:40.434	2026-06-18 10:07:08.595	2026-06-19 10:23:40.435
970258d8-4481-4949-8092-db24245228cb	cc8da27e-4a59-474a-93fe-adfd1589382c	/inventory	3	2026-06-19 10:23:57.238	2026-06-18 10:36:49.577	2026-06-19 10:23:57.239
568363b0-88d8-4323-a897-00becc79662c	cc8da27e-4a59-474a-93fe-adfd1589382c	/ideation	6	2026-06-19 10:24:17.903	2026-06-16 11:35:38.593	2026-06-19 10:24:17.904
ac26a03c-730d-4846-8c21-46c2cf5c388b	cc8da27e-4a59-474a-93fe-adfd1589382c	/visions	6	2026-06-19 10:24:45.495	2026-06-16 10:55:17.318	2026-06-19 10:24:45.496
5af2c586-22f0-4a33-8331-56613a5ee573	cc8da27e-4a59-474a-93fe-adfd1589382c	/ai	8	2026-06-19 10:24:55.638	2026-06-16 10:56:52.722	2026-06-19 10:24:55.639
32c30e69-ca14-43c8-889c-173f576d4fd3	cc8da27e-4a59-474a-93fe-adfd1589382c	/social-stats	2	2026-06-19 10:25:10.529	2026-06-19 10:15:18.521	2026-06-19 10:25:10.53
7132be15-4197-4d59-8580-2a8d474a875f	de5dd353-4173-41b4-8f28-b372fd204c52	/ai	4	2026-06-19 10:36:56.395	2026-06-16 15:46:16.79	2026-06-19 10:36:56.396
b1b5ba32-15e2-418f-bcd6-f3867ea5b7bd	de5dd353-4173-41b4-8f28-b372fd204c52	/roles	1	2026-06-19 10:37:15.313	2026-06-19 10:37:15.314	2026-06-19 10:37:15.314
f91fc9fc-e4fa-44fb-aea9-61232e1046a6	cc8da27e-4a59-474a-93fe-adfd1589382c	/kpis	1	2026-06-16 11:38:11.551	2026-06-16 11:38:11.552	2026-06-16 11:38:11.552
3afc83d4-ec0e-4ab5-9566-76482cddebe5	de5dd353-4173-41b4-8f28-b372fd204c52	/adhoc-work	5	2026-06-19 10:37:19.013	2026-06-16 15:42:45.937	2026-06-19 10:37:19.014
b7e183ac-0f2f-4c00-84a5-265b967b76f2	cc8da27e-4a59-474a-93fe-adfd1589382c	/work	17	2026-06-19 10:51:09.188	2026-06-16 11:01:07.517	2026-06-19 10:51:09.189
a96b43b3-3477-466e-8a4b-8094f88965f0	9f2ddc40-b560-4b23-9393-d227cf4a03af	/hierarchy	2	2026-06-19 10:51:32.749	2026-06-19 09:23:09.16	2026-06-19 10:51:32.75
1c848ca3-71f4-41e7-9b36-56bd4380ae03	9f2ddc40-b560-4b23-9393-d227cf4a03af	/dashboard	6	2026-06-19 10:51:55.9	2026-06-18 13:58:00.905	2026-06-19 10:51:55.901
58ee2b40-348a-4837-8f15-515030b7beba	9f2ddc40-b560-4b23-9393-d227cf4a03af	/work	6	2026-06-19 10:51:56.743	2026-06-19 09:20:52.19	2026-06-19 10:51:56.744
6396451d-3238-40f5-a85c-5c9bce88ffa0	de5dd353-4173-41b4-8f28-b372fd204c52	/contents/eeffe489-420c-45fb-ba93-6a96590d9f3b	4	2026-06-18 11:13:21.642	2026-06-18 10:44:39.719	2026-06-18 11:13:21.643
5d2237e7-f56f-4ff2-af36-c11566b6dc54	de5dd353-4173-41b4-8f28-b372fd204c52	/contents/f5af171e-4572-4220-a36f-350261b988e3	3	2026-06-18 11:23:04.65	2026-06-18 09:38:36.869	2026-06-18 11:23:04.651
d777c102-640f-4af5-bbef-f3b424bed0f0	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/contents/ea0f2ff9-a944-4359-ad21-676320ed25a9	1	2026-06-18 11:24:06.233	2026-06-18 11:24:06.233	2026-06-18 11:24:06.233
4f0b77bf-1059-4a9d-90dc-d62b5f1123a7	de5dd353-4173-41b4-8f28-b372fd204c52	/work	6	2026-06-18 11:36:38.568	2026-06-16 15:45:32.877	2026-06-18 11:36:38.569
0cec0e9e-ab89-452e-b797-dc149ef8ca93	de5dd353-4173-41b4-8f28-b372fd204c52	/dashboard	4	2026-06-18 12:03:53.021	2026-06-16 15:40:26.052	2026-06-18 12:03:53.022
3a54fa8b-3fe0-4745-8995-1b609e946290	de5dd353-4173-41b4-8f28-b372fd204c52	/contents	7	2026-06-18 12:04:17.907	2026-06-18 07:27:12.413	2026-06-18 12:04:17.907
890408fb-b223-4066-99b5-22c60e45413c	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/roles	1	2026-06-17 08:29:52.552	2026-06-17 08:29:52.553	2026-06-17 08:29:52.553
c414d7ef-8d7d-4552-a381-b556286ca47c	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/dashboard	7	2026-06-19 08:25:44.113	2026-06-17 08:26:45.494	2026-06-19 08:25:44.115
42e01d04-f05f-4c8a-bf2e-2a58e2e1bc3f	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/adhoc-work	2	2026-06-19 08:25:49.518	2026-06-17 08:27:18.2	2026-06-19 08:25:49.518
78619273-451e-43fd-acf6-542dba4039be	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/work	4	2026-06-19 08:25:54.305	2026-06-17 08:28:49.8	2026-06-19 08:25:54.306
78ddea7e-4a24-4127-8e27-cb765ddf0f26	9f2ddc40-b560-4b23-9393-d227cf4a03af	/inventory	1	2026-06-19 09:22:48.285	2026-06-19 09:22:48.286	2026-06-19 09:22:48.286
f6d661cf-a7da-4ab7-9865-6b505e66d5ba	9f2ddc40-b560-4b23-9393-d227cf4a03af	/kpis	1	2026-06-19 09:22:55.526	2026-06-19 09:22:55.527	2026-06-19 09:22:55.527
acea64e5-2afe-4a00-a912-8055a68a844e	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/users	3	2026-06-18 07:09:46.743	2026-06-17 08:29:39.53	2026-06-18 07:09:46.744
4b36d82e-d51a-46a6-9091-ca7396757ee9	b5026f0a-0d72-40bd-b28a-e4b86af109bb	/tasks	5	2026-06-18 07:48:54.92	2026-06-17 08:26:59.865	2026-06-18 07:48:54.921
bac54ee9-070b-4c64-9463-6364d5e73d6a	cc8da27e-4a59-474a-93fe-adfd1589382c	/utility	2	2026-06-19 09:28:21.003	2026-06-16 10:58:02.544	2026-06-19 09:28:21.004
1b9765cc-504a-4e91-ade1-cad2aa805bb8	cc8da27e-4a59-474a-93fe-adfd1589382c	/adhoc-work	2	2026-06-19 09:28:39.244	2026-06-19 09:27:46.878	2026-06-19 09:28:39.245
3183d9e2-87ba-441e-af8a-25e60363c2e3	cc8da27e-4a59-474a-93fe-adfd1589382c	/projects	1	2026-06-19 09:28:54.264	2026-06-19 09:28:54.265	2026-06-19 09:28:54.265
cbce9793-9b9c-4339-b7df-f18e65ff4e58	cc8da27e-4a59-474a-93fe-adfd1589382c	/hierarchy	1	2026-06-19 09:28:59.338	2026-06-19 09:28:59.339	2026-06-19 09:28:59.339
e72f3f41-1d0c-44ed-b79c-13954daa50ff	cc8da27e-4a59-474a-93fe-adfd1589382c	/dashboard	31	2026-06-19 10:22:33.026	2026-06-16 10:54:57.956	2026-06-19 10:22:33.027
\.


--
-- Data for Name: Vertical; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Vertical" (id, name, slug, description, "ownerUserId", "createdAt", "updatedAt") FROM stdin;
d2bebdb0-c60e-4fe9-a183-58e7e3978f52	Fiction	fiction	Fiction vertical: stories, novels, and creative narratives.	\N	2026-05-26 10:51:06.69	2026-06-16 08:17:33.628
a3b867ed-6dd9-4593-a67e-5aebfd9efbc4	Non Fiction	non-fiction	Non Fiction vertical: factual content, education, journalism.	\N	2026-05-26 10:51:07.49	2026-06-16 08:17:34.152
\.


--
-- Data for Name: Vision; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Vision" (id, title, description, horizon, "durationMonths", "startsAt", "endsAt", scope, "originalFilename", "mimeType", "fileSizeBytes", "storagePath", "createdById", "createdAt", "updatedAt") FROM stdin;
a64759f7-04f9-47f8-b953-1592e78995ae	Creative Studio Vision	\N	LONG_TERM	12	2026-06-16 10:56:41.355	2027-06-16 10:56:41.355	ALL	Vision_2027.pdf	application/pdf	118220	a64759f7-04f9-47f8-b953-1592e78995ae/a64759f7-04f9-47f8-b953-1592e78995ae.pdf	cc8da27e-4a59-474a-93fe-adfd1589382c	2026-06-16 10:56:41.36	2026-06-16 10:56:41.36
30a75198-951f-49e3-a243-4ec1e3214c6f	Vision 27	\N	LONG_TERM	12	2026-06-16 11:57:40.975	2027-06-16 11:57:40.975	ALL	Vision_2027.pdf	application/pdf	118220	30a75198-951f-49e3-a243-4ec1e3214c6f/30a75198-951f-49e3-a243-4ec1e3214c6f.pdf	cc8da27e-4a59-474a-93fe-adfd1589382c	2026-06-16 11:57:40.978	2026-06-16 11:57:40.978
15a56169-a36c-4084-ba7d-65a7b5ec9380	Vision 27	\N	LONG_TERM	12	2026-06-16 12:26:29.631	2027-06-16 12:26:29.631	ALL	Vision_2027.pdf	application/pdf	118220	15a56169-a36c-4084-ba7d-65a7b5ec9380/15a56169-a36c-4084-ba7d-65a7b5ec9380.pdf	cc8da27e-4a59-474a-93fe-adfd1589382c	2026-06-16 12:26:29.633	2026-06-16 12:26:29.633
\.


--
-- Data for Name: VisionTeam; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VisionTeam" ("visionId", "teamId") FROM stdin;
\.


--
-- Data for Name: VisionUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VisionUser" ("visionId", "userId") FROM stdin;
\.


--
-- Data for Name: VoiceRecording; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VoiceRecording" (id, "userId", source, "originalFilename", "mimeType", "fileSizeBytes", "storagePath", transcript, "sarvamRequestId", "languageCode", "languageProbability", status, "errorMessage", "createdAt", "updatedAt") FROM stdin;
3592a48f-fde6-4a58-8fbe-e723f3fdc537	cc8da27e-4a59-474a-93fe-adfd1589382c	work	memo.webm	audio/webm	921892	cc8da27e-4a59-474a-93fe-adfd1589382c/3592a48f-fde6-4a58-8fbe-e723f3fdc537/3592a48f-fde6-4a58-8fbe-e723f3fdc537.webm	So I need to have a meeting with regarding for the brand and post that we need to create a timeline within which we are going to the next stage of brand. I need to understand his vision of brand right now, what are their priorities? Is it structured more around data or is it structured more around team efficiency and team efficiency? then I had a call with I need to have a call with Naman who is going to be a new entity to go to YC. Then I need to have a call with Dhananjay regarding his roles and responsibilities for this week. What what tasks he needs to complete. I need to have a call with Gyan at 7:30 because he needs help with creating the launch video for his product. And then a couple of meetings with IUC and Devas to onboard them on Brahma.	20260616_3729c0b2-f957-47b0-8df5-b4c4e6bfa6f5	en-IN	\N	COMPLETED	\N	2026-06-16 12:04:15.281	2026-06-16 12:07:34.149
9344ecc7-edae-4519-87bf-d6a7c3fadb20	cc8da27e-4a59-474a-93fe-adfd1589382c	work	memo.webm	audio/webm	702610	cc8da27e-4a59-474a-93fe-adfd1589382c/9344ecc7-edae-4519-87bf-d6a7c3fadb20/9344ecc7-edae-4519-87bf-d6a7c3fadb20.webm	So I need to have a call with Divyam. This is regarding brand and we need to understand what are the next steps for brand. I also need to have a call with Devansh and Ayushi regarding onboarding them on brand. I also need to have a call with Daisy to give her updates on how we are progressing on brand and road to YC.  I also need to have meetings with Dhananjay giving him work for this week.  Then we need to have a conversation with the Abhay Steve about the TAT for the reimbursement of funds that are received by RTY folks. Wrote to IC folks.	20260616_d35a2ab4-e5a4-40b4-9322-4a46fb1f1d56	en-IN	\N	COMPLETED	\N	2026-06-16 12:30:22.006	2026-06-16 12:33:28.111
b736b324-b2f5-4dd4-88aa-ec19c9f65ba7	de5dd353-4173-41b4-8f28-b372fd204c52	work	memo.webm	audio/webm	317144	de5dd353-4173-41b4-8f28-b372fd204c52/b736b324-b2f5-4dd4-88aa-ec19c9f65ba7/b736b324-b2f5-4dd4-88aa-ec19c9f65ba7.webm	We discussed arrangements for the upcoming college event, create a work unit called event planning, add tasks to finalize the venue, coordinate with vendors, and confirm participant registration.	20260618_3d61f74a-1050-49f6-b0a7-38952bc9a9a4	en-IN	\N	COMPLETED	\N	2026-06-18 11:29:41.169	2026-06-18 11:29:44.359
6fecc722-9170-4464-99aa-f43bb1631fad	de5dd353-4173-41b4-8f28-b372fd204c52	work	memo.webm	audio/webm	379934	de5dd353-4173-41b4-8f28-b372fd204c52/6fecc722-9170-4464-99aa-f43bb1631fad/6fecc722-9170-4464-99aa-f43bb1631fad.webm	I had a discussion with the team regarding monthly performance goals, create a work unit called a performance review meeting, add tasks to update individual goals, track pending actions, and schedule the next review. And the name of this is performance review.	20260618_4fab8034-0888-4bdb-84ab-a6f76a6bc8a5	en-IN	\N	COMPLETED	\N	2026-06-18 11:32:26.31	2026-06-18 11:32:29.826
ceba8c38-6a9d-4a80-9241-45b1293df26a	de5dd353-4173-41b4-8f28-b372fd204c52	work	memo.webm	audio/webm	336464	de5dd353-4173-41b4-8f28-b372fd204c52/ceba8c38-6a9d-4a80-9241-45b1293df26a/ceba8c38-6a9d-4a80-9241-45b1293df26a.webm	The title should be performance review and then I had a discussion with the team regarding monthly performance goals, create a work unit called performance review meeting, add tasks to update individual goals. Track pending actions and schedule the next review.	20260618_12889bdf-6908-4a05-bfd7-a80798979160	en-IN	\N	COMPLETED	\N	2026-06-18 11:38:45.341	2026-06-18 11:38:49.185
228a4cdf-eded-411b-99c6-c79d385be054	de5dd353-4173-41b4-8f28-b372fd204c52	work	memo.webm	audio/webm	277538	de5dd353-4173-41b4-8f28-b372fd204c52/228a4cdf-eded-411b-99c6-c79d385be054/228a4cdf-eded-411b-99c6-c79d385be054.webm	Testing need to test the AI query on 21st June. Need to test ad hoc work work units nodes on 23rd June.	20260618_1e6a4729-f8d5-4e51-9660-17d4ee5665df	en-IN	\N	COMPLETED	\N	2026-06-18 11:47:56.674	2026-06-18 11:47:59.58
91086de7-9a27-4feb-ab4a-61cf46f2cd1d	de5dd353-4173-41b4-8f28-b372fd204c52	work	memo.webm	audio/webm	277538	de5dd353-4173-41b4-8f28-b372fd204c52/91086de7-9a27-4feb-ab4a-61cf46f2cd1d/91086de7-9a27-4feb-ab4a-61cf46f2cd1d.webm	Testing need to test the AI query on 21st June. Need to test ad hoc work work units nodes on 23rd June.	20260618_068750fe-204d-4de0-8345-90b839b7596b	en-IN	\N	COMPLETED	\N	2026-06-18 11:48:15.61	2026-06-18 11:48:18.821
\.


--
-- Data for Name: WorkStep; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkStep" (id, "workUnitId", description, deadline, done, "createdAt") FROM stdin;
9c8525c8-aa8b-4ca0-bf2a-b337c4a36f0e	1d712754-e8fb-4099-9acd-71ddce7390f8	Conduct follow-up meetings with students from today's four meetings	2026-06-09 00:00:00	f	2026-06-08 11:46:13.056
37e00056-82ff-456b-937f-4f0bd6a3bdd4	7725c383-6b2a-40d9-a22d-01e26fbcf38e	Attend follow-up meeting	2026-06-13 00:00:00	f	2026-06-08 11:46:15.939
8ebae16f-0f52-44a4-bb98-9990fa11ba43	fb35ca8f-148c-43c9-b7a8-83aa76ca1cc3	Meet with Arun at 6:30	2026-06-08 00:00:00	f	2026-06-08 11:46:18.044
15d9a277-40d8-4379-9b1d-5d6b7dbddbce	07a6eb46-257d-48dc-8c66-8bc246ab2b3a	Contact Abhay Mehta to discuss context layer team	\N	f	2026-06-08 11:46:20.907
cba29a87-2f2e-4ea6-acab-660005963d75	d22e5fdd-ce35-439a-b331-bc291c49c599	Review three scripts from B bus team for student stories	\N	f	2026-06-08 12:04:37.945
fa7024f1-383f-4b10-9048-88d3d4cebcb3	ce315a33-a97f-4e18-9978-83a74cdb9286	Meeting with Sudipto to discuss Instagram operations, planning, and content strategy	\N	f	2026-06-08 12:04:41.324
ce5f331e-f064-4dfc-b259-b14a6e69cd16	6e7e2ea5-72ac-4c2e-a3fd-12869518db19	Meeting with UG team to discuss Startup Weekend coverage and Instagram strategy	\N	f	2026-06-08 12:04:43.192
494692d7-1749-4034-a5c6-afb7a1aa23a0	6e7e2ea5-72ac-4c2e-a3fd-12869518db19	Create and execute Instagram stories and hype-building content for Startup Weekend	2026-06-13 00:00:00	f	2026-06-08 12:04:43.192
a6b2c1d7-aa5d-475a-b0ed-d463068f86fa	7bf4c31a-faf0-4d5d-997b-8bb3c401692f	Check and review two videos from Mani for demo day finale	\N	f	2026-06-08 12:04:45.324
b5ddfbb2-b245-40ed-93d9-608f50ad0f90	7eacd09d-8879-405d-bc44-4164cce9cb30	Follow up with Samar on demo day finale stories	2026-06-08 00:00:00	f	2026-06-08 12:14:37.976
08ade424-1780-4108-b9c6-8d9a9adac618	9564ff19-ae81-446d-8426-e5ab9a1b3f61	Held stakeholder meeting to discuss production plan, guest confirmation, and student confirmation	\N	f	2026-06-08 13:19:28.415
134f285c-f54e-4866-8e58-85f54d630648	9564ff19-ae81-446d-8426-e5ab9a1b3f61	Lock production plan	2026-06-09 00:00:00	f	2026-06-08 13:19:28.415
68fe8f4c-3938-4872-a9c7-fa0752ace1da	49c3fb76-f5bd-42d1-91b5-7a87b15b0789	Prepare mail with MOU and all planned deals	2026-06-08 00:00:00	f	2026-06-08 13:19:31.563
01d4c355-dc87-4f50-9c29-e36df3b4fa8c	49c3fb76-f5bd-42d1-91b5-7a87b15b0789	Send mail to hub and obtain MOU signatures	2026-06-09 00:00:00	f	2026-06-08 13:19:31.563
7896bcf7-a8d9-459d-95d7-4f4a6002623f	4a9c732f-579e-433d-bf86-01982a654dd3	Determine final event date (June 13th or 14th)	2026-06-09 00:00:00	f	2026-06-08 13:19:37.383
52af6c54-fb92-40c8-8f43-c722d79f2140	4a9c732f-579e-433d-bf86-01982a654dd3	Send communication to all 100 students with their assigned pitch date	2026-06-09 00:00:00	f	2026-06-08 13:19:37.383
2474b832-f151-4a51-aabd-4fc847dda38a	51bd5826-19f8-4e95-b27c-366697857f09	Travel to Bangalore 2 days before event date	2026-06-11 00:00:00	f	2026-06-08 13:19:41.175
83dc44fa-5a95-4176-9c73-9828db2c6719	51bd5826-19f8-4e95-b27c-366697857f09	Conduct location recce and assess venue setup requirements	2026-06-12 00:00:00	f	2026-06-08 13:19:41.175
0f72b690-72b9-42c1-b537-baad34c433e6	e7e10c48-b1fe-42bc-9362-565a733ffc0a	Begin venue setup at 6:00 AM	2026-06-13 00:00:00	f	2026-06-08 13:19:42.997
2d4d268d-072a-49f6-bd34-8d4f70da3889	e7e10c48-b1fe-42bc-9362-565a733ffc0a	Start shooting at 10:00 AM and continue until 8:00 PM	2026-06-13 00:00:00	f	2026-06-08 13:19:42.997
c5cac2da-fbd5-4caa-9210-50cfe80ced46	3672accb-5138-40d6-9c2a-5bdf51e83c49	Lock final list of 10 guests	2026-06-09 00:00:00	t	2026-06-08 13:23:13.787
e962a23f-a3a8-4b3b-881e-7a8b849be3a6	08c0d4d6-94f7-4bc4-a8a7-7ebeb010dff1	Get on a call with Tanjit today to learn how to create UTM links, or alternatively sit with the Shark Tank guy next to Gautam	2026-06-08 00:00:00	f	2026-06-08 13:31:24.787
db3c93a5-3f7b-4576-b850-f935d0c1ae69	08c0d4d6-94f7-4bc4-a8a7-7ebeb010dff1	Create UTM links for all 11 creators	\N	f	2026-06-08 13:31:24.787
6407d3ad-ff44-426a-b526-b3ec900fae3f	08c0d4d6-94f7-4bc4-a8a7-7ebeb010dff1	Create Nasdaily's UTM link	2026-06-08 00:00:00	f	2026-06-08 13:31:24.787
23ee1a86-34dc-4813-9ce6-e460d7c4ea13	08c0d4d6-94f7-4bc4-a8a7-7ebeb010dff1	Set up monitoring system for leads from UTM links	\N	f	2026-06-08 13:31:24.787
ffaabc90-13b5-4c53-9a9a-be4b4e199d5b	51944cc1-eaff-4822-8dc2-c9f9b6d6c8df	Get update on what every single creator is doing	2026-06-08 00:00:00	f	2026-06-08 13:31:28.209
979422af-0d8c-48a0-878f-f955a88767b2	51944cc1-eaff-4822-8dc2-c9f9b6d6c8df	Update the sheet sent to Sudeepto with creator status	2026-06-08 00:00:00	f	2026-06-08 13:31:28.209
cab259b0-cc82-4c69-94f2-34218d6817ff	51944cc1-eaff-4822-8dc2-c9f9b6d6c8df	Notify Sudeepto that the sheet has been updated	2026-06-08 00:00:00	f	2026-06-08 13:31:28.209
300daab2-1a5b-4b41-a1dd-bf54c27d35f8	9af1b42d-0997-4a12-96fe-8ca3ba53e346	Update the influencer marketing 2026 collabs list and send to Sudipto	\N	f	2026-06-08 13:31:32.844
ce930bad-9d08-4712-b5dc-c0c5000e947e	5b693ca7-5da4-45c8-8679-b2024aa0dcee	Speak to Amal about sharing final drafts and get update on narrative planning status for NAS	\N	f	2026-06-08 13:31:34.845
2974e82d-d806-4927-8ec2-27d99664c3b6	5b693ca7-5da4-45c8-8679-b2024aa0dcee	Request roster from Amal covering UGC creators, native pages, and amplification pages	\N	f	2026-06-08 13:31:34.845
72bc23df-88d9-4bfb-983d-2417483780ef	5b693ca7-5da4-45c8-8679-b2024aa0dcee	Plan cadence for 11 creator live sessions (staggered or all at once)	\N	f	2026-06-08 13:31:34.845
bf1a396c-32ae-4d22-a228-a256bf38ea68	5b693ca7-5da4-45c8-8679-b2024aa0dcee	Share final drafts across all creators	\N	f	2026-06-08 13:31:34.845
7927f5f2-b201-42c7-9efd-6f7d7cd9fbc0	5b693ca7-5da4-45c8-8679-b2024aa0dcee	Take all 11 creators live throughout the week	\N	f	2026-06-08 13:31:34.845
b49ef2df-b144-4640-82c4-41eff65d9dd1	b316159e-baa2-4d51-baaa-092a03788875	Launch campaign live for first three days	\N	f	2026-06-08 13:31:36.953
f922054a-2a56-42ce-87c1-83438dc0986e	b316159e-baa2-4d51-baaa-092a03788875	Follow up with Chirag on amplification costings status and whether to add separately	\N	f	2026-06-08 13:31:36.953
41d64353-de75-4ca2-9d73-c9502885f783	b316159e-baa2-4d51-baaa-092a03788875	Move campaign to amplification phase for next three days	\N	f	2026-06-08 13:31:36.953
ef32e64d-2b9c-43d4-97eb-62c1d229c7a8	43af630a-1886-40af-8f2a-39f06f337a69	Follow up with Raghav at end of day for status update on every single creator	2026-06-08 00:00:00	t	2026-06-08 16:03:38.407
2cefdd65-2729-4185-b3ef-ca3b5a471d50	db73b66d-3c7e-425e-a992-e1311f3d1f0d	Book flights for 5 team members to Bangalore on priority	2026-06-08 00:00:00	t	2026-06-08 16:06:02.049
13ba2002-b699-4fbf-954e-69ec9732b9c8	31d72f4d-d26a-4185-b585-74a144c24bc8	Organize team celebration with parties and drinks after event concludes	2026-06-14 00:00:00	t	2026-06-08 16:07:16.944
8c9585e2-d01c-4c44-a120-25217fa2a8b3	31d72f4d-d26a-4185-b585-74a144c24bc8	Start shooting at 10:00 AM and continue until 8:00 PM	2026-06-14 00:00:00	t	2026-06-08 16:07:16.944
fa7cfeef-39f0-48ff-b20a-6a90e25e7c2c	2487f0a0-9fa8-4f10-b584-774f42a83166	Attend meeting with UG team	2026-06-09 17:00:00	f	2026-06-08 16:09:01.374
e10ee5ea-131c-40af-ba79-3e3cf71735fb	1747c3aa-2891-4f1c-83ba-86381e1aef9d	Meet with Arun	2026-06-09 14:00:00	f	2026-06-08 16:09:04.217
db921caf-97e1-408e-87fe-26764ff68af5	bde1c07c-5973-45e7-90a1-f1665af12d0d	Pack bag for Bangalore trip in the evening	2026-06-12 00:00:00	f	2026-06-08 16:09:06.061
5e45fe08-3c83-4920-9832-d87c9b08f3b4	fdc12eae-117c-4ba6-8af7-b7eb728c7b58	Meet with Abhay	2026-06-11 00:00:00	f	2026-06-08 16:09:08.405
d2e1cd0d-1afe-4179-b293-8cafbe0e4893	44a49069-05ad-4564-b8f8-a80fb6099eea	Work session with Savara team	2026-06-13 00:00:00	f	2026-06-08 16:09:10.168
a121da58-641c-4061-8746-b670e7209f08	44a49069-05ad-4564-b8f8-a80fb6099eea	Follow-up meeting with Savara team	2026-06-16 00:00:00	f	2026-06-08 16:09:10.168
864dd848-5f27-4e13-b442-4ddfbae4fd43	9942ec49-fa7e-4fba-b0be-41482cfc60f3	Talk to Ishika about the YouTube plot and application requirements	2026-06-13 00:00:00	f	2026-06-08 16:09:11.952
d2285b7c-dc6b-4c48-894d-6fd1ca4559c8	5d677856-dec8-43ed-9ee3-ec3d6a922bc6	Meeting with the UG team helddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd	2026-06-09 00:00:00	f	2026-06-09 11:44:21.558
9397bbe5-ecaf-449c-a8a5-b9a2772daa29	5d677856-dec8-43ed-9ee3-ec3d6a922bc6	Follow up on action items	2026-06-10 10:30:00	t	2026-06-09 11:44:21.558
ff6d334b-df26-4a7a-9cd8-69cb95308095	65d3b43a-023b-4e42-8c75-7cda0d65d190	Reviewed latest website changes with the design team	\N	f	2026-06-09 11:51:15.998
81eed71c-e8ec-4744-9769-8ba57e6252e9	65d3b43a-023b-4e42-8c75-7cda0d65d190	Document UI issues	\N	f	2026-06-09 11:51:15.998
a9809e50-9da6-4a71-885d-c46c271773f0	65d3b43a-023b-4e42-8c75-7cda0d65d190	Share feedback with the design team	\N	f	2026-06-09 11:51:15.998
7a47a4be-0129-46c5-a562-82523ba9e8a5	65d3b43a-023b-4e42-8c75-7cda0d65d190	Verify fixes	2026-06-13 00:00:00	f	2026-06-09 11:51:15.998
2d9b4491-aefa-4645-b1e0-f999154fbf89	4f41144e-4322-41d2-bc77-3b40f459fe3c	Review latest website changes with the design team	\N	f	2026-06-09 11:54:14.003
6fbf4392-e4cf-4a9b-bc11-f28c8b2e15fd	4f41144e-4322-41d2-bc77-3b40f459fe3c	Document UI issues	\N	f	2026-06-09 11:54:14.003
455b304d-4b55-4522-887d-9a000a4a1b08	4f41144e-4322-41d2-bc77-3b40f459fe3c	Share feedback with the design team	\N	f	2026-06-09 11:54:14.003
c08846b8-645f-437f-bd4a-b26f7a8e6d1e	4f41144e-4322-41d2-bc77-3b40f459fe3c	Verify fixes	2026-06-13 00:00:00	f	2026-06-09 11:54:14.003
331341c4-0dfa-45c9-be55-2b9bcdd288bb	675d30ed-e38a-4c1d-a25d-a5638c63f66c	CALL	2026-06-09 13:00:00	f	2026-06-09 13:02:17.865
59a13bdd-8cc3-4974-9a9b-79d341536dd7	20f702f7-59f3-46d7-bdfe-62b987d21b98	Call with Sudeep	2026-06-09 10:30:00	f	2026-06-11 07:09:12.874
7d640b32-9bff-477e-9003-dfb20b5a306b	20f702f7-59f3-46d7-bdfe-62b987d21b98	Call with Dhannjay	2026-06-09 11:00:00	t	2026-06-11 07:09:12.874
1be09c9c-f360-49aa-9f53-ffe297a68219	ac41d152-e57d-45f9-b165-3d5c017c136b	Schedule and conduct call with Divyam regarding brand strategy and next steps	\N	f	2026-06-16 12:33:31.601
37ec0985-afa9-4cd4-b0f4-e9d3585f6518	61ba1153-bec7-47d6-b25c-2f2037cb46e4	Schedule and conduct call with Devansh and Ayushi to onboard them on brand	\N	f	2026-06-16 12:33:31.663
2aa55765-7044-46cf-b162-66c3c53e0361	68e750e0-26d0-4084-88be-2ea386bc9051	Schedule and conduct call with Daisy to give updates on brand progress and road to YC	\N	f	2026-06-16 12:33:31.725
081b11bd-681e-44fe-814e-2ea91d6667c7	26e8eb6d-5de2-4d97-84c1-2fd6995dd7b7	Schedule and conduct meeting with Dhananjay to assign work for this week	\N	f	2026-06-16 12:33:31.758
63d3e186-b3d5-4af5-a9d3-194f0208b10d	b577b701-998a-4d6f-a268-51b1edf44d83	Schedule and conduct conversation with Abhay and Steve about TAT for reimbursement of funds received by RTY folks	\N	f	2026-06-16 12:33:31.795
05d68717-27b9-4c76-8319-2fafeb1f5d50	d7ebacdb-7505-4870-87b3-133ea5886e8e	Wrote to IC folks	\N	f	2026-06-16 12:33:31.829
e9464c4f-a413-4fb2-aa46-1f1bf0f31070	7adf2b20-62cd-4e18-8aa3-850ed88db1d2	Finalize the venue	\N	f	2026-06-18 11:29:45.66
fe0c6ed5-bc03-40e9-bb64-2da8f0c3f2a7	7adf2b20-62cd-4e18-8aa3-850ed88db1d2	Coordinate with vendors	\N	f	2026-06-18 11:29:45.66
f3cb5ac7-e9f4-4f4d-aab7-032c0290a53a	7adf2b20-62cd-4e18-8aa3-850ed88db1d2	Confirm participant registration	\N	f	2026-06-18 11:29:45.66
a0f92f07-01c7-4848-9704-8f2150640dad	53571329-ca4a-4bb7-abf9-5d2dc6e01c8f	Conduct performance review meeting with team	\N	f	2026-06-18 11:32:31.186
8941aaa4-249a-4ec0-b5f1-42217ec7b04b	53571329-ca4a-4bb7-abf9-5d2dc6e01c8f	Update individual goals	\N	f	2026-06-18 11:32:31.186
72a839a4-1518-48cf-8336-11e3b421bd71	53571329-ca4a-4bb7-abf9-5d2dc6e01c8f	Track pending actions	\N	f	2026-06-18 11:32:31.186
a451876b-d1fb-42eb-856c-869c924385ad	53571329-ca4a-4bb7-abf9-5d2dc6e01c8f	Schedule next review	\N	f	2026-06-18 11:32:31.186
59f21eca-4622-4779-8be4-4125ac4b4316	c7658992-939f-42af-959c-39e265f079cb	Conduct performance review meeting with team	\N	f	2026-06-18 11:38:50.557
c769f41c-a6ab-40b8-b4ea-f2789c09437a	c7658992-939f-42af-959c-39e265f079cb	Update individual goals based on discussion	\N	f	2026-06-18 11:38:50.557
151c22fb-0033-44a7-a75a-ef1d9d58bad5	c7658992-939f-42af-959c-39e265f079cb	Track pending actions from review	\N	f	2026-06-18 11:38:50.557
1edfb55d-de35-4a30-b242-d1f269a714bf	c7658992-939f-42af-959c-39e265f079cb	Schedule next performance review	\N	f	2026-06-18 11:38:50.557
38d2a18d-c6fb-458f-ac51-7b0335167b9f	eb413677-d42b-4506-9ee1-f0d764ffa316	Test the AI query	2026-06-21 00:00:00	f	2026-06-18 11:48:01.054
186c203f-9595-4fa1-9c2f-1efabfb69bd8	13ff28cb-6c3f-4df7-bf8f-e13d20f18407	Test ad hoc work units nodes	2026-06-23 00:00:00	f	2026-06-18 11:48:01.103
f5aa5e5a-91fe-4b81-8925-5bad779d211e	ceaaa977-88e7-44b4-b4a3-d947f719c58d	Take feedback on demo from Sabhya, Ishika, Naveen, Ratnam and Raja.	\N	f	2026-06-19 08:48:42.592
4615bff5-32cc-4fdd-9f70-583c5a9c4fcf	ceaaa977-88e7-44b4-b4a3-d947f719c58d	Give demo to Devansh, Sudipto, Ananya Dengri and Ayushi Kothari.	\N	f	2026-06-19 08:48:42.592
4546b98e-fd98-48dd-a0c1-3c72908667e5	b48ae864-762a-4077-92e7-1b259d1b3be3	Take carousal analysis from Ayushi Kothari - Why certain carousal perform well and why certain carousal does not?	\N	f	2026-06-19 08:52:34.603
6509c993-0c28-43b3-8b1e-ccaf6b0a1a8b	7caf3c77-513c-4d50-b71c-b0ffc654ba7f	Make a detailed doc related to required Ops for hosting Hackathon.	\N	t	2026-06-22 07:38:22.848
0f5dfcbc-36c0-433e-be6b-5cbf7ba147ab	7caf3c77-513c-4d50-b71c-b0ffc654ba7f	Reach out to YC and YC India team.	\N	f	2026-06-22 07:38:22.848
4af23a91-b49f-4e90-9d73-1f0259519a89	7caf3c77-513c-4d50-b71c-b0ffc654ba7f	Problem Statement to be made with ref with YC RFS.	\N	f	2026-06-22 07:38:22.848
0144f39c-094e-46a2-a283-d1bc19184bee	7caf3c77-513c-4d50-b71c-b0ffc654ba7f	Make a detailed doc on how OpenAI and Sequoia has hosted hackathons.	\N	t	2026-06-22 07:38:22.848
178d1dbc-dac8-4782-be53-1c8726001a09	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Complete the process of onboarding Chaithanya via MR team	\N	t	2026-06-22 07:38:30.749
1352ad52-f7dd-423e-8699-53910d9081ce	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Dashboard feature additions and automation. Features: Company Docs and point systems.	\N	f	2026-06-22 07:38:30.749
23e2adc9-a672-46e9-bf43-5d913dc715b8	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Closure of Asks ASAP	\N	f	2026-06-22 07:38:30.749
a93ce7ce-acb1-4d19-8380-52e3437285ec	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Find next 5-7 YC backed founders to get for the program	\N	f	2026-06-22 07:38:30.749
1a0b2bd9-9fe6-4220-8a82-f81dad2818fa	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Contact YC India team	\N	f	2026-06-22 07:38:30.749
9de419b5-7079-46db-b9ff-d184b75fdcd1	35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	Talk about TAT on funds to Ent. Cell and Finance team.	\N	f	2026-06-22 07:38:30.749
\.


--
-- Data for Name: WorkUnit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WorkUnit" (id, "userId", title, context, status, "isPrivate", "createdAt", "updatedAt", "closedAt", "nextDueAt", "firstDueAt", "audioRecordingId") FROM stdin;
1d712754-e8fb-4099-9acd-71ddce7390f8	058c404a-165c-4ccc-a0d4-eacf23950652	Follow up meetings with students from today's four meetings	Four meetings were held today with students that require follow-up	OPEN	f	2026-06-08 11:46:13.056	2026-06-08 11:46:13.056	\N	\N	\N	\N
7725c383-6b2a-40d9-a22d-01e26fbcf38e	058c404a-165c-4ccc-a0d4-eacf23950652	Follow-up meeting on Friday	A follow-up meeting is scheduled for Friday	OPEN	f	2026-06-08 11:46:15.939	2026-06-08 11:46:15.939	\N	\N	\N	\N
fb35ca8f-148c-43c9-b7a8-83aa76ca1cc3	058c404a-165c-4ccc-a0d4-eacf23950652	Meeting with Arun	Meeting scheduled with Arun at 6:30	OPEN	f	2026-06-08 11:46:18.044	2026-06-08 11:46:18.044	\N	\N	\N	\N
07a6eb46-257d-48dc-8c66-8bc246ab2b3a	058c404a-165c-4ccc-a0d4-eacf23950652	Discuss context layer team with Abhay Mehta	Need to talk to Abhay Mehta about the context layer team	OPEN	f	2026-06-08 11:46:20.907	2026-06-08 11:46:20.907	\N	\N	\N	\N
d22e5fdd-ce35-439a-b331-bc291c49c599	058c404a-165c-4ccc-a0d4-eacf23950652	Review scripts from B bus team for student stories	Checked three scripts shared by B bus team for student stories content	CLOSED	f	2026-06-08 12:04:37.945	2026-06-08 12:04:37.945	\N	\N	\N	\N
ce315a33-a97f-4e18-9978-83a74cdb9286	058c404a-165c-4ccc-a0d4-eacf23950652	Onboard Sudipto on social media strategy and Instagram operations	Met with Sudipto, new head of socials, to walk through current Instagram operations and future plans. Discussed content strategy which currently focuses on student stories with consistent page aesthetic	CLOSED	f	2026-06-08 12:04:41.324	2026-06-08 12:04:41.324	\N	\N	\N	\N
6e7e2ea5-72ac-4c2e-a3fd-12869518db19	058c404a-165c-4ccc-a0d4-eacf23950652	Plan Instagram coverage for Startup Weekend	Met with UG team to discuss coverage strategy for Startup Weekend event on June 13-14. Need to plan Instagram stories and build hype around the event	OPEN	f	2026-06-08 12:04:43.192	2026-06-08 12:04:43.192	\N	\N	\N	\N
7bf4c31a-faf0-4d5d-997b-8bb3c401692f	058c404a-165c-4ccc-a0d4-eacf23950652	Review demo day finale videos from Mani	Two videos completed by Mani for the demo day finale event that occurred on Saturday	OPEN	f	2026-06-08 12:04:45.324	2026-06-08 12:04:45.324	\N	\N	\N	\N
7eacd09d-8879-405d-bc44-4164cce9cb30	058c404a-165c-4ccc-a0d4-eacf23950652	Follow up on demo day finale stories completion	Demo day finale stories need to be finished today. Need to follow up with Samar on completion	CLOSED	f	2026-06-08 12:04:48.608	2026-06-08 12:14:37.976	\N	\N	\N	\N
9564ff19-ae81-446d-8426-e5ab9a1b3f61	058c404a-165c-4ccc-a0d4-eacf23950652	Lock Production Plan for Elevator Pitch Event	Elevator pitch event in Bangalore on June 13th or 14th with 10 guest VCs/founders and ~100 student pitches. Selected startups receive 1 lakh rupees funding.	OPEN	f	2026-06-08 13:19:28.415	2026-06-08 13:19:28.415	\N	\N	\N	\N
49c3fb76-f5bd-42d1-91b5-7a87b15b0789	058c404a-165c-4ccc-a0d4-eacf23950652	Send MOU and Event Partnership Agreement to Hub	Hub is the event partner for the Bangalore elevator pitch event	OPEN	f	2026-06-08 13:19:31.563	2026-06-08 13:19:31.563	\N	\N	\N	\N
4a9c732f-579e-433d-bf86-01982a654dd3	058c404a-165c-4ccc-a0d4-eacf23950652	Communicate Event Date to Student Participants	~100 students need to know whether they are pitching on June 13th or 14th	OPEN	f	2026-06-08 13:19:37.383	2026-06-08 13:19:37.383	\N	\N	\N	\N
51bd5826-19f8-4e95-b27c-366697857f09	058c404a-165c-4ccc-a0d4-eacf23950652	Conduct Location Recce in Bangalore	Lead organizer needs to visit venue in advance of event to assess setup and logistics	OPEN	f	2026-06-08 13:19:41.175	2026-06-08 13:19:41.175	\N	\N	\N	\N
e7e10c48-b1fe-42bc-9362-565a733ffc0a	058c404a-165c-4ccc-a0d4-eacf23950652	Execute Elevator Pitch Event - Day 1	First day of shooting for elevator pitch event in Bangalore	OPEN	f	2026-06-08 13:19:42.997	2026-06-08 13:19:42.997	\N	\N	\N	\N
1747c3aa-2891-4f1c-83ba-86381e1aef9d	058c404a-165c-4ccc-a0d4-eacf23950652	Sit with Arun	One-on-one meeting with Arun	OPEN	f	2026-06-08 16:09:04.217	2026-06-08 16:09:04.217	\N	2026-06-09 14:00:00	2026-06-09 14:00:00	\N
bde1c07c-5973-45e7-90a1-f1665af12d0d	058c404a-165c-4ccc-a0d4-eacf23950652	Pack bag for Bangalore trip	Prepare luggage for Bangalore trip on Thursday	OPEN	f	2026-06-08 16:09:06.061	2026-06-08 16:09:06.061	\N	2026-06-12 00:00:00	2026-06-12 00:00:00	\N
08c0d4d6-94f7-4bc4-a8a7-7ebeb010dff1	058c404a-165c-4ccc-a0d4-eacf23950652	Create UTM links for dropout fund campaign creators	Dropout fund campaign has 11 creators lined up. Need to create UTM links for all creators and specifically for Nasdaily's link today.	OPEN	f	2026-06-08 13:31:24.787	2026-06-08 13:31:24.787	\N	\N	\N	\N
51944cc1-eaff-4822-8dc2-c9f9b6d6c8df	058c404a-165c-4ccc-a0d4-eacf23950652	Update creator status sheet and notify Sudeepto	Need to track what every single creator is doing in the dropout fund campaign and maintain the shared sheet.	OPEN	f	2026-06-08 13:31:28.209	2026-06-08 13:31:28.209	\N	\N	\N	\N
9af1b42d-0997-4a12-96fe-8ca3ba53e346	058c404a-165c-4ccc-a0d4-eacf23950652	Update influencer marketing 2026 collabs list	Influencer marketing 2026 collabs list has been sent to Sudipto but has not been updated yet.	OPEN	f	2026-06-08 13:31:32.844	2026-06-08 13:31:32.844	\N	\N	\N	\N
5b693ca7-5da4-45c8-8679-b2024aa0dcee	058c404a-165c-4ccc-a0d4-eacf23950652	Plan and execute creator live sessions	Need to take all 11 creators live throughout the week. Must plan cadence and share final drafts.	OPEN	f	2026-06-08 13:31:34.845	2026-06-08 13:31:34.845	\N	\N	\N	\N
b316159e-baa2-4d51-baaa-092a03788875	058c404a-165c-4ccc-a0d4-eacf23950652	Execute campaign launch and amplification phases	Campaign will run in two phases: initial 3 days live, then 3 days amplification phase.	OPEN	f	2026-06-08 13:31:36.953	2026-06-08 13:31:36.953	\N	\N	\N	\N
3672accb-5138-40d6-9c2a-5bdf51e83c49	058c404a-165c-4ccc-a0d4-eacf23950652	Confirm Guest List for Elevator Pitch	Need to lock list of 10 VCs and founders who will be judging student pitches	CLOSED	f	2026-06-08 13:19:35.381	2026-06-08 16:06:20.099	\N	\N	\N	\N
31d72f4d-d26a-4185-b585-74a144c24bc8	058c404a-165c-4ccc-a0d4-eacf23950652	Execute Elevator Pitch Event - Day 2	Second day of shooting for elevator pitch event in Bangalore	CLOSED	f	2026-06-08 13:19:44.805	2026-06-08 16:07:16.944	2026-06-08 16:07:16.941	\N	2026-06-14 00:00:00	\N
43af630a-1886-40af-8f2a-39f06f337a69	058c404a-165c-4ccc-a0d4-eacf23950652	Get daily creator status updates from Raghav	Need to track status of every single creator throughout the campaign week.	CLOSED	f	2026-06-08 13:31:38.651	2026-06-08 16:06:17.581	\N	\N	\N	\N
db73b66d-3c7e-425e-a992-e1311f3d1f0d	058c404a-165c-4ccc-a0d4-eacf23950652	Book Flights for Team Travel to Bangalore	5 team members need to travel to Bangalore for the event. 2 team members already on-site. Lead organizer arriving 2 days early for location recce.	CLOSED	f	2026-06-08 13:19:39.328	2026-06-08 16:06:19.274	\N	\N	\N	\N
2487f0a0-9fa8-4f10-b584-774f42a83166	058c404a-165c-4ccc-a0d4-eacf23950652	Meeting with UG team	Scheduled meeting with the UG team	OPEN	f	2026-06-08 16:09:01.374	2026-06-08 16:09:01.374	\N	2026-06-09 17:00:00	2026-06-09 17:00:00	\N
fdc12eae-117c-4ba6-8af7-b7eb728c7b58	058c404a-165c-4ccc-a0d4-eacf23950652	Sit with Abhay	One-on-one meeting with Abhay	OPEN	f	2026-06-08 16:09:08.405	2026-06-08 16:09:08.405	\N	2026-06-11 00:00:00	2026-06-11 00:00:00	\N
44a49069-05ad-4564-b8f8-a80fb6099eea	058c404a-165c-4ccc-a0d4-eacf23950652	Work with Savara team	Collaboration with Savara team including follow-up meeting	OPEN	f	2026-06-08 16:09:10.168	2026-06-08 16:09:10.168	\N	2026-06-13 00:00:00	2026-06-13 00:00:00	\N
9942ec49-fa7e-4fba-b0be-41482cfc60f3	058c404a-165c-4ccc-a0d4-eacf23950652	Discuss YouTube plot and application with Ishika	Talk to Ishika about YouTube plot and application creation requirements	OPEN	f	2026-06-08 16:09:11.952	2026-06-08 16:09:11.952	\N	2026-06-13 00:00:00	2026-06-13 00:00:00	\N
65d3b43a-023b-4e42-8c75-7cda0d65d190	de5dd353-4173-41b4-8f28-b372fd204c52	website review feedback	Reviewed latest website changes with the design team	OPEN	f	2026-06-09 11:51:15.998	2026-06-09 11:51:15.998	\N	2026-06-13 00:00:00	2026-06-13 00:00:00	\N
5d677856-dec8-43ed-9ee3-ec3d6a922bc6	de5dd353-4173-41b4-8f28-b372fd204c52	Meeting with the UG team	Discussed pending deliverables for the current sprint	OPEN	f	2026-06-09 11:38:24.401	2026-06-09 11:44:21.558	\N	2026-06-09 00:00:00	2026-06-09 00:00:00	\N
4f41144e-4322-41d2-bc77-3b40f459fe3c	de5dd353-4173-41b4-8f28-b372fd204c52	website review feedback	Reviewed latest website changes with the design team	OPEN	f	2026-06-09 11:54:14.003	2026-06-09 11:54:14.003	\N	2026-06-13 00:00:00	2026-06-13 00:00:00	\N
7ba3f394-f4d6-4a87-ac1c-14fd9572f3e2	de5dd353-4173-41b4-8f28-b372fd204c52	TEST PRIVATE	We discussed arrangements for the upcoming college event. Create a work unit called 'Event Planning'. Add tasks to finalize the venue, coordinate with vendors, and confirm participant registrations.	OPEN	t	2026-06-09 13:01:39.206	2026-06-09 13:01:39.206	\N	\N	\N	\N
675d30ed-e38a-4c1d-a25d-a5638c63f66c	de5dd353-4173-41b4-8f28-b372fd204c52	TEST PRIVATE	We discussed arrangements for the upcoming college event. Create a work unit called 'Event Planning'. Add tasks to finalize the venue, coordinate with vendors, and confirm participant registrations.	OPEN	t	2026-06-09 13:00:47.723	2026-06-09 13:02:17.865	\N	2026-06-09 13:00:00	2026-06-09 13:00:00	\N
20f702f7-59f3-46d7-bdfe-62b987d21b98	de5dd353-4173-41b4-8f28-b372fd204c52	Team Intro	Test	OPEN	f	2026-06-09 11:01:05.308	2026-06-11 07:09:12.874	\N	2026-06-09 10:30:00	2026-06-09 10:30:00	\N
ac41d152-e57d-45f9-b165-3d5c017c136b	cc8da27e-4a59-474a-93fe-adfd1589382c	Call with Divyam about brand next steps	Understand what are the next steps for brand	OPEN	f	2026-06-16 12:33:31.601	2026-06-16 12:33:31.601	\N	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
61ba1153-bec7-47d6-b25c-2f2037cb46e4	cc8da27e-4a59-474a-93fe-adfd1589382c	Onboarding call with Devansh and Ayushi on brand	Onboard Devansh and Ayushi on brand initiatives	OPEN	f	2026-06-16 12:33:31.663	2026-06-16 12:33:31.663	\N	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
68e750e0-26d0-4084-88be-2ea386bc9051	cc8da27e-4a59-474a-93fe-adfd1589382c	Update call with Daisy on brand and YC progress	Provide updates on brand progress and road to YC	OPEN	f	2026-06-16 12:33:31.725	2026-06-16 12:33:31.725	\N	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
26e8eb6d-5de2-4d97-84c1-2fd6995dd7b7	cc8da27e-4a59-474a-93fe-adfd1589382c	Meeting with Dhananjay for weekly work assignment	Assign work to Dhananjay for this week	OPEN	f	2026-06-16 12:33:31.758	2026-06-16 12:33:31.758	\N	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
b577b701-998a-4d6f-a268-51b1edf44d83	cc8da27e-4a59-474a-93fe-adfd1589382c	Discuss reimbursement TAT with Abhay and Steve	Clarify turnaround time for reimbursement of funds received by RTY folks	OPEN	f	2026-06-16 12:33:31.795	2026-06-16 12:33:31.795	\N	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
d7ebacdb-7505-4870-87b3-133ea5886e8e	cc8da27e-4a59-474a-93fe-adfd1589382c	Communication sent to IC folks	Wrote to IC folks regarding pending matters	CLOSED	f	2026-06-16 12:33:31.829	2026-06-16 12:33:31.829	2026-06-16 12:33:31.829	\N	\N	9344ecc7-edae-4519-87bf-d6a7c3fadb20
7adf2b20-62cd-4e18-8aa3-850ed88db1d2	de5dd353-4173-41b4-8f28-b372fd204c52	Event Planning	Arrangements for the upcoming college event	OPEN	f	2026-06-18 11:29:45.66	2026-06-18 11:29:45.66	\N	\N	\N	b736b324-b2f5-4dd4-88aa-ec19c9f65ba7
53571329-ca4a-4bb7-abf9-5d2dc6e01c8f	de5dd353-4173-41b4-8f28-b372fd204c52	Performance Review Meeting	Discussion with team regarding monthly performance goals	OPEN	f	2026-06-18 11:32:31.186	2026-06-18 11:32:31.186	\N	\N	\N	6fecc722-9170-4464-99aa-f43bb1631fad
c7658992-939f-42af-959c-39e265f079cb	de5dd353-4173-41b4-8f28-b372fd204c52	Performance review meeting	Discussion with the team regarding monthly performance goals	OPEN	f	2026-06-18 11:38:50.557	2026-06-18 11:38:50.557	\N	\N	\N	ceba8c38-6a9d-4a80-9241-45b1293df26a
eb413677-d42b-4506-9ee1-f0d764ffa316	de5dd353-4173-41b4-8f28-b372fd204c52	Test AI query	Testing need to test the AI query	OPEN	f	2026-06-18 11:48:01.054	2026-06-18 11:48:01.054	\N	2026-06-21 00:00:00	2026-06-21 00:00:00	228a4cdf-eded-411b-99c6-c79d385be054
13ff28cb-6c3f-4df7-bf8f-e13d20f18407	de5dd353-4173-41b4-8f28-b372fd204c52	Test ad hoc work units nodes	Need to test ad hoc work work units nodes	OPEN	f	2026-06-18 11:48:01.103	2026-06-18 11:48:01.103	\N	2026-06-23 00:00:00	2026-06-23 00:00:00	228a4cdf-eded-411b-99c6-c79d385be054
ceaaa977-88e7-44b4-b4a3-d947f719c58d	b5026f0a-0d72-40bd-b28a-e4b86af109bb	Tribe V2	Tribe V2 is a platform that analyses on Brand Assets.	OPEN	f	2026-06-19 08:48:42.592	2026-06-19 08:48:42.592	\N	\N	\N	\N
b48ae864-762a-4077-92e7-1b259d1b3be3	b5026f0a-0d72-40bd-b28a-e4b86af109bb	Content Creation Summit - SMB 3	Brand Assets AI Search Dashboard	OPEN	f	2026-06-19 08:52:34.603	2026-06-19 08:52:34.603	\N	\N	\N	\N
7caf3c77-513c-4d50-b71c-b0ffc654ba7f	b5026f0a-0d72-40bd-b28a-e4b86af109bb	RTY Hackathon	Launch RTY Hackathon. Onboard YC team on the name and, try to get them as judges and mentors.	OPEN	f	2026-06-19 08:46:44.794	2026-06-22 07:38:22.848	\N	\N	\N	\N
35a45fa8-e102-4fb6-bd73-b63f4bc1b08d	b5026f0a-0d72-40bd-b28a-e4b86af109bb	Road To YC	Will be tracking every actionable related to RTY.	OPEN	f	2026-06-19 08:36:37.414	2026-06-22 07:38:30.749	\N	\N	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b8c846ae-7f4b-4043-91dc-6f99e80e3b70	1e643b4b02f50d3218d11189880f072f0f4563b4bc9d2b018e1b28b245885b0d	2026-05-26 09:37:00.622135+00	20260526150000_init_postgresql	\N	\N	2026-05-26 09:37:00.557415+00	1
45103567-a7f5-48da-a653-9bfe99ae0ae2	4a07347cd67f443ebcfe19bba9ee57c6ba4f6fac53a4a6d02f24c6d072645f20	2026-05-29 13:24:15.035951+00	20260529120000_add_adhoc_work	\N	\N	2026-05-29 13:24:13.476053+00	1
a2b5c5ce-c839-4b03-9eee-ddbeb787e20e	d92595e240bc08028b354c72ef7d3092b22bb2432a44509906bb1b3aae4b58b0	2026-06-04 10:00:42.998713+00	20260604000000_init		\N	2026-06-04 10:00:42.998713+00	0
8470945c-1280-4570-b102-b7eae207b0f8	5d488ee7d04d75f815232356f5eaee6e906aa4f54e0fd757d0fdcf0be460c62a	2026-06-09 09:52:53.726269+00	20260608120000_work_unit_due_fields	\N	\N	2026-06-09 09:52:53.051735+00	1
8e567220-2941-43e4-865c-c147d42f03de	c0e1d03e41985fda4f4f465633e449e21c791c370387b5b46ef102393ac9d408	2026-06-13 13:24:23.76781+00	20260608180000_voice_recordings	\N	\N	2026-06-13 13:24:23.735858+00	1
e25bb38c-d010-4754-a294-64b4a310d757	fe5a109d2b28125e7f58d5a97d48a49d8813eaf95474543a48f1b0969d43ad24	2026-06-16 09:22:48.05535+00	20260613120000_user_kpis	\N	\N	2026-06-16 09:22:46.702552+00	1
cc674cc3-336e-4137-9f18-dcac46fb4c21	70ab9fc2cc70006ab64ec263b176ec2231d58ca7b45cd28e3e5f0c76b78793c9	2026-06-16 09:34:45.512437+00	20260613140000_visions	\N	\N	2026-06-16 09:34:44.113597+00	1
411701d2-7d20-4a20-9127-5cc90c9daa33	9e960021920b910cdcfb32425b43d076fe79a9206b493f9c04084b2d1544cc00	2026-06-16 10:14:16.837063+00	20260613160000_navigation_analytics	\N	\N	2026-06-16 10:14:16.803457+00	1
068170fa-99a7-4908-b587-75e849b3d05a	9d2d57740977911a48dd789de2d3e86239b7e3870e09518285fef5f77a401fa9	2026-06-16 11:38:19.615465+00	20260613180000_thumbnail_generator	\N	\N	2026-06-16 11:38:19.578068+00	1
5c5fd356-97bf-4a19-9b22-acf9e5d52605	9ac468712aeaa4cef6d0e745a077bdb853c44784e412e5be4c3de7f4e3a3a39c	2026-06-16 12:00:23.816142+00	20260616120000_user_kpi_is_key	\N	\N	2026-06-16 12:00:23.786307+00	1
1ae510c3-411f-493a-9b34-4fbb9167a63b	aa5ae4c71df33b6f4cc4e401202d719eb7d13c3f2e8d5dac1b571446ddd54810	2026-06-18 10:15:02.957206+00	20260617120000_inventory	\N	\N	2026-06-18 10:15:01.596411+00	1
\.


--
-- Name: AdhocWork AdhocWork_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdhocWork"
    ADD CONSTRAINT "AdhocWork_pkey" PRIMARY KEY (id);


--
-- Name: AiQuery AiQuery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiQuery"
    ADD CONSTRAINT "AiQuery_pkey" PRIMARY KEY (id);


--
-- Name: ContentNodeOutput ContentNodeOutput_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeOutput"
    ADD CONSTRAINT "ContentNodeOutput_pkey" PRIMARY KEY (id);


--
-- Name: ContentNodeResource ContentNodeResource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeResource"
    ADD CONSTRAINT "ContentNodeResource_pkey" PRIMARY KEY (id);


--
-- Name: ContentNodeTeamMember ContentNodeTeamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeTeamMember"
    ADD CONSTRAINT "ContentNodeTeamMember_pkey" PRIMARY KEY (id);


--
-- Name: ContentNode ContentNode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNode"
    ADD CONSTRAINT "ContentNode_pkey" PRIMARY KEY (id);


--
-- Name: Content Content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Content"
    ADD CONSTRAINT "Content_pkey" PRIMARY KEY (id);


--
-- Name: IdeaMatch IdeaMatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdeaMatch"
    ADD CONSTRAINT "IdeaMatch_pkey" PRIMARY KEY (id);


--
-- Name: Idea Idea_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Idea"
    ADD CONSTRAINT "Idea_pkey" PRIMARY KEY (id);


--
-- Name: InstagramPerformance InstagramPerformance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InstagramPerformance"
    ADD CONSTRAINT "InstagramPerformance_pkey" PRIMARY KEY (id);


--
-- Name: InventoryItemTeam InventoryItemTeam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItemTeam"
    ADD CONSTRAINT "InventoryItemTeam_pkey" PRIMARY KEY ("inventoryItemId", "teamId");


--
-- Name: InventoryItem InventoryItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_pkey" PRIMARY KEY (id);


--
-- Name: InventoryReservation InventoryReservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReservation"
    ADD CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY (id);


--
-- Name: NavSearchLog NavSearchLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NavSearchLog"
    ADD CONSTRAINT "NavSearchLog_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Permission Permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permission"
    ADD CONSTRAINT "Permission_pkey" PRIMARY KEY (id);


--
-- Name: ProjectMember ProjectMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_pkey" PRIMARY KEY (id);


--
-- Name: ProjectPhase ProjectPhase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectPhase"
    ADD CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: RolePermission RolePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: SocialAccount SocialAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialAccount"
    ADD CONSTRAINT "SocialAccount_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TeamMember TeamMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: ThumbnailGeneration ThumbnailGeneration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ThumbnailGeneration"
    ADD CONSTRAINT "ThumbnailGeneration_pkey" PRIMARY KEY (id);


--
-- Name: UserKpi UserKpi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserKpi"
    ADD CONSTRAINT "UserKpi_pkey" PRIMARY KEY (id);


--
-- Name: UserPageVisit UserPageVisit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPageVisit"
    ADD CONSTRAINT "UserPageVisit_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Vertical Vertical_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vertical"
    ADD CONSTRAINT "Vertical_pkey" PRIMARY KEY (id);


--
-- Name: VisionTeam VisionTeam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionTeam"
    ADD CONSTRAINT "VisionTeam_pkey" PRIMARY KEY ("visionId", "teamId");


--
-- Name: VisionUser VisionUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionUser"
    ADD CONSTRAINT "VisionUser_pkey" PRIMARY KEY ("visionId", "userId");


--
-- Name: Vision Vision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vision"
    ADD CONSTRAINT "Vision_pkey" PRIMARY KEY (id);


--
-- Name: VoiceRecording VoiceRecording_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VoiceRecording"
    ADD CONSTRAINT "VoiceRecording_pkey" PRIMARY KEY (id);


--
-- Name: WorkStep WorkStep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkStep"
    ADD CONSTRAINT "WorkStep_pkey" PRIMARY KEY (id);


--
-- Name: WorkUnit WorkUnit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkUnit"
    ADD CONSTRAINT "WorkUnit_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AdhocWork_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdhocWork_userId_createdAt_idx" ON public."AdhocWork" USING btree ("userId", "createdAt");


--
-- Name: AdhocWork_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AdhocWork_userId_idx" ON public."AdhocWork" USING btree ("userId");


--
-- Name: AiQuery_normalizedQuery_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiQuery_normalizedQuery_idx" ON public."AiQuery" USING btree ("normalizedQuery");


--
-- Name: AiQuery_scope_targetUserId_rangeFrom_rangeTo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiQuery_scope_targetUserId_rangeFrom_rangeTo_idx" ON public."AiQuery" USING btree (scope, "targetUserId", "rangeFrom", "rangeTo");


--
-- Name: AiQuery_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiQuery_userId_createdAt_idx" ON public."AiQuery" USING btree ("userId", "createdAt");


--
-- Name: ContentNodeOutput_nodeId_approvalState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeOutput_nodeId_approvalState_idx" ON public."ContentNodeOutput" USING btree ("nodeId", "approvalState");


--
-- Name: ContentNodeOutput_nodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeOutput_nodeId_idx" ON public."ContentNodeOutput" USING btree ("nodeId");


--
-- Name: ContentNodeResource_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeResource_inventoryItemId_idx" ON public."ContentNodeResource" USING btree ("inventoryItemId");


--
-- Name: ContentNodeResource_nodeId_approvalState_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeResource_nodeId_approvalState_idx" ON public."ContentNodeResource" USING btree ("nodeId", "approvalState");


--
-- Name: ContentNodeResource_nodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeResource_nodeId_idx" ON public."ContentNodeResource" USING btree ("nodeId");


--
-- Name: ContentNodeResource_nodeId_sourceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeResource_nodeId_sourceType_idx" ON public."ContentNodeResource" USING btree ("nodeId", "sourceType");


--
-- Name: ContentNodeTeamMember_nodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeTeamMember_nodeId_idx" ON public."ContentNodeTeamMember" USING btree ("nodeId");


--
-- Name: ContentNodeTeamMember_nodeId_userId_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContentNodeTeamMember_nodeId_userId_role_key" ON public."ContentNodeTeamMember" USING btree ("nodeId", "userId", role);


--
-- Name: ContentNodeTeamMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNodeTeamMember_userId_idx" ON public."ContentNodeTeamMember" USING btree ("userId");


--
-- Name: ContentNode_contentId_orderIndex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ContentNode_contentId_orderIndex_idx" ON public."ContentNode" USING btree ("contentId", "orderIndex");


--
-- Name: ContentNode_contentId_orderIndex_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ContentNode_contentId_orderIndex_key" ON public."ContentNode" USING btree ("contentId", "orderIndex");


--
-- Name: Content_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Content_createdById_idx" ON public."Content" USING btree ("createdById");


--
-- Name: Content_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Content_projectId_idx" ON public."Content" USING btree ("projectId");


--
-- Name: Content_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Content_status_idx" ON public."Content" USING btree (status);


--
-- Name: Content_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Content_teamId_idx" ON public."Content" USING btree ("teamId");


--
-- Name: Content_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Content_type_idx" ON public."Content" USING btree (type);


--
-- Name: IdeaMatch_ideaId_candidateIdeaId_matchedUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IdeaMatch_ideaId_candidateIdeaId_matchedUserId_key" ON public."IdeaMatch" USING btree ("ideaId", "candidateIdeaId", "matchedUserId");


--
-- Name: IdeaMatch_ideaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IdeaMatch_ideaId_idx" ON public."IdeaMatch" USING btree ("ideaId");


--
-- Name: IdeaMatch_matchedUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IdeaMatch_matchedUserId_createdAt_idx" ON public."IdeaMatch" USING btree ("matchedUserId", "createdAt");


--
-- Name: IdeaMatch_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IdeaMatch_score_idx" ON public."IdeaMatch" USING btree (score);


--
-- Name: Idea_authorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Idea_authorId_createdAt_idx" ON public."Idea" USING btree ("authorId", "createdAt");


--
-- Name: Idea_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Idea_authorId_idx" ON public."Idea" USING btree ("authorId");


--
-- Name: Idea_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Idea_createdAt_idx" ON public."Idea" USING btree ("createdAt");


--
-- Name: InstagramPerformance_language_mentionedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InstagramPerformance_language_mentionedAt_idx" ON public."InstagramPerformance" USING btree (language, "mentionedAt");


--
-- Name: InstagramPerformance_mentionedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InstagramPerformance_mentionedAt_idx" ON public."InstagramPerformance" USING btree ("mentionedAt");


--
-- Name: InstagramPerformance_sourceItemId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InstagramPerformance_sourceItemId_key" ON public."InstagramPerformance" USING btree ("sourceItemId");


--
-- Name: InstagramPerformance_source_language_mentionedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InstagramPerformance_source_language_mentionedAt_idx" ON public."InstagramPerformance" USING btree (source, language, "mentionedAt");


--
-- Name: InstagramPerformance_source_mentionedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InstagramPerformance_source_mentionedAt_idx" ON public."InstagramPerformance" USING btree (source, "mentionedAt");


--
-- Name: InventoryItemTeam_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItemTeam_teamId_idx" ON public."InventoryItemTeam" USING btree ("teamId");


--
-- Name: InventoryItem_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_category_idx" ON public."InventoryItem" USING btree (category);


--
-- Name: InventoryItem_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_isActive_idx" ON public."InventoryItem" USING btree ("isActive");


--
-- Name: InventoryItem_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_name_idx" ON public."InventoryItem" USING btree (name);


--
-- Name: InventoryItem_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryItem_status_idx" ON public."InventoryItem" USING btree (status);


--
-- Name: InventoryReservation_contentNodeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReservation_contentNodeId_idx" ON public."InventoryReservation" USING btree ("contentNodeId");


--
-- Name: InventoryReservation_contentNodeResourceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryReservation_contentNodeResourceId_key" ON public."InventoryReservation" USING btree ("contentNodeResourceId");


--
-- Name: InventoryReservation_dueBackAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReservation_dueBackAt_idx" ON public."InventoryReservation" USING btree ("dueBackAt");


--
-- Name: InventoryReservation_inventoryItemId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReservation_inventoryItemId_status_idx" ON public."InventoryReservation" USING btree ("inventoryItemId", status);


--
-- Name: InventoryReservation_status_dueBackAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryReservation_status_dueBackAt_idx" ON public."InventoryReservation" USING btree (status, "dueBackAt");


--
-- Name: NavSearchLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NavSearchLog_userId_createdAt_idx" ON public."NavSearchLog" USING btree ("userId", "createdAt");


--
-- Name: Notification_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_createdAt_idx" ON public."Notification" USING btree ("userId", "createdAt");


--
-- Name: Notification_userId_dedupeKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON public."Notification" USING btree ("userId", "dedupeKey");


--
-- Name: Notification_userId_readAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_readAt_idx" ON public."Notification" USING btree ("userId", "readAt");


--
-- Name: Permission_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Permission_name_key" ON public."Permission" USING btree (name);


--
-- Name: ProjectMember_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectMember_projectId_idx" ON public."ProjectMember" USING btree ("projectId");


--
-- Name: ProjectMember_projectId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON public."ProjectMember" USING btree ("projectId", "userId");


--
-- Name: ProjectMember_reportsToUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectMember_reportsToUserId_idx" ON public."ProjectMember" USING btree ("reportsToUserId");


--
-- Name: ProjectMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectMember_userId_idx" ON public."ProjectMember" USING btree ("userId");


--
-- Name: ProjectPhase_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectPhase_deadline_idx" ON public."ProjectPhase" USING btree (deadline);


--
-- Name: ProjectPhase_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectPhase_projectId_idx" ON public."ProjectPhase" USING btree ("projectId");


--
-- Name: ProjectPhase_projectId_orderIndex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ProjectPhase_projectId_orderIndex_idx" ON public."ProjectPhase" USING btree ("projectId", "orderIndex");


--
-- Name: Project_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_createdById_idx" ON public."Project" USING btree ("createdById");


--
-- Name: Project_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_name_idx" ON public."Project" USING btree (name);


--
-- Name: Project_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_status_idx" ON public."Project" USING btree (status);


--
-- Name: Project_verticalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_verticalId_idx" ON public."Project" USING btree ("verticalId");


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: SocialAccount_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SocialAccount_userId_idx" ON public."SocialAccount" USING btree ("userId");


--
-- Name: SocialAccount_userId_platform_platformAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SocialAccount_userId_platform_platformAccountId_key" ON public."SocialAccount" USING btree ("userId", platform, "platformAccountId");


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);


--
-- Name: Task_type_platform_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_type_platform_idx" ON public."Task" USING btree (type, platform);


--
-- Name: Task_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_userId_createdAt_idx" ON public."Task" USING btree ("userId", "createdAt");


--
-- Name: Task_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_userId_idx" ON public."Task" USING btree ("userId");


--
-- Name: Task_userId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_userId_status_idx" ON public."Task" USING btree ("userId", status);


--
-- Name: TeamMember_reportsToUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeamMember_reportsToUserId_idx" ON public."TeamMember" USING btree ("reportsToUserId");


--
-- Name: TeamMember_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeamMember_teamId_idx" ON public."TeamMember" USING btree ("teamId");


--
-- Name: TeamMember_teamId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON public."TeamMember" USING btree ("teamId", "userId");


--
-- Name: TeamMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TeamMember_userId_idx" ON public."TeamMember" USING btree ("userId");


--
-- Name: Team_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_createdById_idx" ON public."Team" USING btree ("createdById");


--
-- Name: Team_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_name_idx" ON public."Team" USING btree (name);


--
-- Name: Team_verticalId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Team_verticalId_idx" ON public."Team" USING btree ("verticalId");


--
-- Name: ThumbnailGeneration_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ThumbnailGeneration_userId_createdAt_idx" ON public."ThumbnailGeneration" USING btree ("userId", "createdAt");


--
-- Name: UserKpi_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserKpi_createdById_idx" ON public."UserKpi" USING btree ("createdById");


--
-- Name: UserKpi_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserKpi_userId_idx" ON public."UserKpi" USING btree ("userId");


--
-- Name: UserKpi_userId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserKpi_userId_isActive_idx" ON public."UserKpi" USING btree ("userId", "isActive");


--
-- Name: UserKpi_userId_isKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserKpi_userId_isKey_idx" ON public."UserKpi" USING btree ("userId", "isKey");


--
-- Name: UserKpi_userId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserKpi_userId_sortOrder_idx" ON public."UserKpi" USING btree ("userId", "sortOrder");


--
-- Name: UserPageVisit_userId_lastVisitedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserPageVisit_userId_lastVisitedAt_idx" ON public."UserPageVisit" USING btree ("userId", "lastVisitedAt");


--
-- Name: UserPageVisit_userId_path_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserPageVisit_userId_path_key" ON public."UserPageVisit" USING btree ("userId", path);


--
-- Name: UserPageVisit_userId_visitCount_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserPageVisit_userId_visitCount_idx" ON public."UserPageVisit" USING btree ("userId", "visitCount");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_googleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_googleId_idx" ON public."User" USING btree ("googleId");


--
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- Name: Vertical_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Vertical_name_key" ON public."Vertical" USING btree (name);


--
-- Name: Vertical_ownerUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vertical_ownerUserId_idx" ON public."Vertical" USING btree ("ownerUserId");


--
-- Name: Vertical_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vertical_slug_idx" ON public."Vertical" USING btree (slug);


--
-- Name: Vertical_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Vertical_slug_key" ON public."Vertical" USING btree (slug);


--
-- Name: VisionTeam_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VisionTeam_teamId_idx" ON public."VisionTeam" USING btree ("teamId");


--
-- Name: VisionUser_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VisionUser_userId_idx" ON public."VisionUser" USING btree ("userId");


--
-- Name: Vision_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vision_createdById_idx" ON public."Vision" USING btree ("createdById");


--
-- Name: Vision_horizon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vision_horizon_idx" ON public."Vision" USING btree (horizon);


--
-- Name: Vision_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vision_scope_idx" ON public."Vision" USING btree (scope);


--
-- Name: Vision_startsAt_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Vision_startsAt_endsAt_idx" ON public."Vision" USING btree ("startsAt", "endsAt");


--
-- Name: VoiceRecording_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VoiceRecording_source_idx" ON public."VoiceRecording" USING btree (source);


--
-- Name: VoiceRecording_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VoiceRecording_userId_createdAt_idx" ON public."VoiceRecording" USING btree ("userId", "createdAt");


--
-- Name: VoiceRecording_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "VoiceRecording_userId_idx" ON public."VoiceRecording" USING btree ("userId");


--
-- Name: WorkStep_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkStep_deadline_idx" ON public."WorkStep" USING btree (deadline);


--
-- Name: WorkStep_workUnitId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkStep_workUnitId_idx" ON public."WorkStep" USING btree ("workUnitId");


--
-- Name: WorkUnit_audioRecordingId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_audioRecordingId_idx" ON public."WorkUnit" USING btree ("audioRecordingId");


--
-- Name: WorkUnit_closedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_closedAt_idx" ON public."WorkUnit" USING btree ("closedAt");


--
-- Name: WorkUnit_firstDueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_firstDueAt_idx" ON public."WorkUnit" USING btree ("firstDueAt");


--
-- Name: WorkUnit_isPrivate_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_isPrivate_idx" ON public."WorkUnit" USING btree ("isPrivate");


--
-- Name: WorkUnit_nextDueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_nextDueAt_idx" ON public."WorkUnit" USING btree ("nextDueAt");


--
-- Name: WorkUnit_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_status_idx" ON public."WorkUnit" USING btree (status);


--
-- Name: WorkUnit_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_userId_createdAt_idx" ON public."WorkUnit" USING btree ("userId", "createdAt");


--
-- Name: WorkUnit_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkUnit_userId_idx" ON public."WorkUnit" USING btree ("userId");


--
-- Name: AdhocWork AdhocWork_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AdhocWork"
    ADD CONSTRAINT "AdhocWork_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AiQuery AiQuery_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiQuery"
    ADD CONSTRAINT "AiQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: ContentNodeOutput ContentNodeOutput_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeOutput"
    ADD CONSTRAINT "ContentNodeOutput_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public."ContentNode"(id) ON DELETE CASCADE;


--
-- Name: ContentNodeOutput ContentNodeOutput_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeOutput"
    ADD CONSTRAINT "ContentNodeOutput_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"(id);


--
-- Name: ContentNodeOutput ContentNodeOutput_submittedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeOutput"
    ADD CONSTRAINT "ContentNodeOutput_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES public."User"(id);


--
-- Name: ContentNodeResource ContentNodeResource_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeResource"
    ADD CONSTRAINT "ContentNodeResource_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public."InventoryItem"(id) ON DELETE SET NULL;


--
-- Name: ContentNodeResource ContentNodeResource_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeResource"
    ADD CONSTRAINT "ContentNodeResource_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public."ContentNode"(id) ON DELETE CASCADE;


--
-- Name: ContentNodeResource ContentNodeResource_requestedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeResource"
    ADD CONSTRAINT "ContentNodeResource_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES public."User"(id);


--
-- Name: ContentNodeResource ContentNodeResource_reviewedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeResource"
    ADD CONSTRAINT "ContentNodeResource_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES public."User"(id);


--
-- Name: ContentNodeTeamMember ContentNodeTeamMember_nodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeTeamMember"
    ADD CONSTRAINT "ContentNodeTeamMember_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public."ContentNode"(id) ON DELETE CASCADE;


--
-- Name: ContentNodeTeamMember ContentNodeTeamMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNodeTeamMember"
    ADD CONSTRAINT "ContentNodeTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id);


--
-- Name: ContentNode ContentNode_contentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ContentNode"
    ADD CONSTRAINT "ContentNode_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES public."Content"(id) ON DELETE CASCADE;


--
-- Name: Content Content_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Content"
    ADD CONSTRAINT "Content_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Content Content_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Content"
    ADD CONSTRAINT "Content_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id);


--
-- Name: Content Content_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Content"
    ADD CONSTRAINT "Content_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id);


--
-- Name: IdeaMatch IdeaMatch_candidateIdeaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdeaMatch"
    ADD CONSTRAINT "IdeaMatch_candidateIdeaId_fkey" FOREIGN KEY ("candidateIdeaId") REFERENCES public."Idea"(id);


--
-- Name: IdeaMatch IdeaMatch_ideaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdeaMatch"
    ADD CONSTRAINT "IdeaMatch_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES public."Idea"(id) ON DELETE CASCADE;


--
-- Name: IdeaMatch IdeaMatch_matchedUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."IdeaMatch"
    ADD CONSTRAINT "IdeaMatch_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES public."User"(id);


--
-- Name: Idea Idea_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Idea"
    ADD CONSTRAINT "Idea_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: InventoryItemTeam InventoryItemTeam_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItemTeam"
    ADD CONSTRAINT "InventoryItemTeam_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public."InventoryItem"(id) ON DELETE CASCADE;


--
-- Name: InventoryItemTeam InventoryItemTeam_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryItemTeam"
    ADD CONSTRAINT "InventoryItemTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON DELETE CASCADE;


--
-- Name: InventoryReservation InventoryReservation_contentNodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReservation"
    ADD CONSTRAINT "InventoryReservation_contentNodeId_fkey" FOREIGN KEY ("contentNodeId") REFERENCES public."ContentNode"(id) ON DELETE CASCADE;


--
-- Name: InventoryReservation InventoryReservation_contentNodeResourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReservation"
    ADD CONSTRAINT "InventoryReservation_contentNodeResourceId_fkey" FOREIGN KEY ("contentNodeResourceId") REFERENCES public."ContentNodeResource"(id) ON DELETE CASCADE;


--
-- Name: InventoryReservation InventoryReservation_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReservation"
    ADD CONSTRAINT "InventoryReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id);


--
-- Name: InventoryReservation InventoryReservation_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryReservation"
    ADD CONSTRAINT "InventoryReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public."InventoryItem"(id) ON DELETE CASCADE;


--
-- Name: NavSearchLog NavSearchLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NavSearchLog"
    ADD CONSTRAINT "NavSearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_reportsToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_reportsToUserId_fkey" FOREIGN KEY ("reportsToUserId") REFERENCES public."User"(id);


--
-- Name: ProjectMember ProjectMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id);


--
-- Name: ProjectPhase ProjectPhase_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ProjectPhase"
    ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON DELETE CASCADE;


--
-- Name: Project Project_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Project Project_verticalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES public."Vertical"(id);


--
-- Name: RolePermission RolePermission_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public."Permission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SocialAccount SocialAccount_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SocialAccount"
    ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TeamMember TeamMember_reportsToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_reportsToUserId_fkey" FOREIGN KEY ("reportsToUserId") REFERENCES public."User"(id);


--
-- Name: TeamMember TeamMember_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON DELETE CASCADE;


--
-- Name: TeamMember TeamMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamMember"
    ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id);


--
-- Name: Team Team_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Team Team_verticalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES public."Vertical"(id);


--
-- Name: ThumbnailGeneration ThumbnailGeneration_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ThumbnailGeneration"
    ADD CONSTRAINT "ThumbnailGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserKpi UserKpi_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserKpi"
    ADD CONSTRAINT "UserKpi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id);


--
-- Name: UserKpi UserKpi_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserKpi"
    ADD CONSTRAINT "UserKpi_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: UserPageVisit UserPageVisit_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPageVisit"
    ADD CONSTRAINT "UserPageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Vertical Vertical_ownerUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vertical"
    ADD CONSTRAINT "Vertical_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES public."User"(id);


--
-- Name: VisionTeam VisionTeam_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionTeam"
    ADD CONSTRAINT "VisionTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON DELETE CASCADE;


--
-- Name: VisionTeam VisionTeam_visionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionTeam"
    ADD CONSTRAINT "VisionTeam_visionId_fkey" FOREIGN KEY ("visionId") REFERENCES public."Vision"(id) ON DELETE CASCADE;


--
-- Name: VisionUser VisionUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionUser"
    ADD CONSTRAINT "VisionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: VisionUser VisionUser_visionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VisionUser"
    ADD CONSTRAINT "VisionUser_visionId_fkey" FOREIGN KEY ("visionId") REFERENCES public."Vision"(id) ON DELETE CASCADE;


--
-- Name: Vision Vision_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Vision"
    ADD CONSTRAINT "Vision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id);


--
-- Name: VoiceRecording VoiceRecording_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VoiceRecording"
    ADD CONSTRAINT "VoiceRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- Name: WorkStep WorkStep_workUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkStep"
    ADD CONSTRAINT "WorkStep_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES public."WorkUnit"(id) ON DELETE CASCADE;


--
-- Name: WorkUnit WorkUnit_audioRecordingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkUnit"
    ADD CONSTRAINT "WorkUnit_audioRecordingId_fkey" FOREIGN KEY ("audioRecordingId") REFERENCES public."VoiceRecording"(id) ON DELETE SET NULL;


--
-- Name: WorkUnit WorkUnit_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkUnit"
    ADD CONSTRAINT "WorkUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Kz2TZzS6eJBHshnKYt5ghgDgQxn0vKwgWVGeCefBxgchWht2Bz8M85aNTVLiMgb

