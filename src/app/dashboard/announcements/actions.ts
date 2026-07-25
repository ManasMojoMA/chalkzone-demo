"use server";


import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from "@/lib/announcement-categories";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { isStaff, requireRole, requireUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";

const ANNOUNCEMENT_BUCKET = "announcements";
const MAX_BANNER_BYTES = 10 * 1024 * 1024;

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "s", "u", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

// ─── Targeting options (admin composer) ─────────────────────────────────────

export async function getTargetingOptions() {
  await requireRole("ADMIN", "SUPER_ADMIN");

  const [programs, semesters, sections, subjects] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { program: { not: null } },
      select: { program: true },
      distinct: ["program"],
    }),
    prisma.studentProfile.findMany({
      where: { currentSemester: { not: null } },
      select: { currentSemester: true },
      distinct: ["currentSemester"],
    }),
    prisma.studentProfile.findMany({
      where: { section: { not: null } },
      select: { section: true },
      distinct: ["section"],
    }),
    prisma.subject.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return {
    programs: programs.map((p) => p.program!).sort(),
    semesters: semesters.map((s) => s.currentSemester!).sort((a, b) => a - b),
    sections: sections.map((s) => s.section!).sort(),
    subjects,
  };
}

// ─── Create / delete ────────────────────────────────────────────────────────

export async function createAnnouncement(formData: FormData) {
  if (!(await hasSectionEdit("announcements"))) return { success: false as const, error: "Your role has view-only access to this section. Ask an administrator for edit access." };

  const user = await requireRole("ADMIN", "SUPER_ADMIN");

  const title = ((formData.get("title") as string) || "").trim();
  const rawHtml = (formData.get("contentHtml") as string) || "";
  const program = (formData.get("program") as string) || "";
  const semester = (formData.get("semester") as string) || "";
  const section = (formData.get("section") as string) || "";
  const subjectId = (formData.get("subjectId") as string) || "";
  const banner = formData.get("banner") as File | null;
  const categoryRaw = (formData.get("category") as string) || "ALERTS";
  const category: AnnouncementCategory = ANNOUNCEMENT_CATEGORIES.includes(categoryRaw as AnnouncementCategory)
    ? (categoryRaw as AnnouncementCategory)
    : "ALERTS";

  if (!title || title.length < 3) return { success: false as const, error: "Title must be at least 3 characters" };
  const contentHtml = sanitizeHtml(rawHtml, SANITIZE_OPTS);
  if (sanitizeHtml(contentHtml, { allowedTags: [], allowedAttributes: {} }).trim().length < 3) {
    return { success: false as const, error: "Please write some content" };
  }

  // Optional banner upload (public bucket → stable public URL)
  let bannerPath: string | null = null;
  if (banner && banner.size > 0) {
    if (banner.size > MAX_BANNER_BYTES) return { success: false as const, error: "Banner exceeds the 10MB limit" };
    if (!banner.type.startsWith("image/")) return { success: false as const, error: "Banner must be an image" };
    const safeName = banner.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 100);
    const path = `${crypto.randomUUID()}-${safeName}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(ANNOUNCEMENT_BUCKET)
      .upload(path, Buffer.from(await banner.arrayBuffer()), { contentType: banner.type });
    if (error) {
      console.error("Banner upload failed:", error);
      return { success: false as const, error: "Banner upload failed" };
    }
    bannerPath = path;
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      contentHtml,
      bannerPath,
      category,
      authorId: user.id,
      targets: {
        create: [
          {
            program: program || null,
            semester: semester ? Number(semester) : null,
            section: section || null,
            subjectId: subjectId || null,
          },
        ],
      },
    },
  });

  // Fan-out notifications to the audience
  const audience = await resolveAudience({ program, semester, section, subjectId });
  await notify(
    audience,
    {
      type: "ANNOUNCEMENT",
      title: `📢 ${title}`,
      body: sanitizeHtml(contentHtml, { allowedTags: [], allowedAttributes: {} }).slice(0, 120),
      link: "/dashboard/announcements",
    },
    user.id
  );

  revalidatePath("/dashboard/announcements");
  return { success: true as const, id: announcement.id };
}

/** Campus-wide (no filters) → every active user. Otherwise → students whose
 *  profile matches every provided filter (course filter matches students with
 *  marks/attendance in that subject). */
async function resolveAudience(f: { program: string; semester: string; section: string; subjectId: string }) {
  const campusWide = !f.program && !f.semester && !f.section && !f.subjectId;
  if (campusWide) {
    const all = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    return all.map((u) => u.id);
  }

  const profiles = await prisma.studentProfile.findMany({
    where: {
      ...(f.program ? { program: f.program } : {}),
      ...(f.semester ? { currentSemester: Number(f.semester) } : {}),
      ...(f.section ? { section: f.section } : {}),
      ...(f.subjectId
        ? {
            OR: [
              { attendances: { some: { subjectId: f.subjectId } } },
              { marks: { some: { subjectId: f.subjectId } } },
            ],
          }
        : {}),
    },
    select: { userId: true },
  });
  return profiles.map((p) => p.userId);
}

export async function deleteAnnouncement(id: string) {
  const user = await requireRole("ADMIN", "SUPER_ADMIN");
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return { success: false as const, error: "Not found" };
  if (a.authorId !== user.id && user.role !== "SUPER_ADMIN") {
    return { success: false as const, error: "Only the author or a super admin can delete this" };
  }
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/dashboard/announcements");
  return { success: true as const };
}

// ─── Reading ────────────────────────────────────────────────────────────────

export async function getAnnouncementsForMe() {
  const user = await requireUser();
  const staff = isStaff(user);

  const all = await prisma.announcement.findMany({
    include: {
      author: { select: { name: true } },
      targets: { include: { subject: { select: { code: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Staff/admin see everything. Students see campus-wide + announcements
  // matching their profile.
  let visible = all;
  if (!staff) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { attendances: { select: { subjectId: true } }, marks: { select: { subjectId: true } } },
    });
    const mySubjects = new Set([
      ...(profile?.attendances.map((a) => a.subjectId) ?? []),
      ...(profile?.marks.map((m) => m.subjectId) ?? []),
    ]);
    visible = all.filter((a) =>
      a.targets.some((t) => {
        if (t.program && t.program !== profile?.program) return false;
        if (t.semester && t.semester !== profile?.currentSemester) return false;
        if (t.section && t.section !== profile?.section) return false;
        if (t.subjectId && !mySubjects.has(t.subjectId)) return false;
        return true;
      })
    );
  }

  // Attach public banner URLs (deterministic — no network round-trip)
  const supabase = createAdminClient();
  return visible.map((a) => ({
    ...a,
    bannerUrl: a.bannerPath
      ? supabase.storage.from(ANNOUNCEMENT_BUCKET).getPublicUrl(a.bannerPath).data.publicUrl
      : null,
  }));
}
