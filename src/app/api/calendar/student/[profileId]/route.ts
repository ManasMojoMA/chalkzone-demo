import prisma from "@/lib/prisma";
import { buildWeekIcs, PERIOD_TIMES } from "@/lib/ics";

const SLOT_INCLUDE = {
  assignment: {
    include: {
      subject: true,
      faculty: { include: { user: { select: { name: true } } } },
    },
  },
  classroom: true,
  section: { include: { program: true } },
} as const;

/**
 * Personal live iCalendar feed for one student: their home section's classes,
 * with courses swapped out for the section they're actually enrolled in when
 * that differs (electives / cross-section enrollment). Public but keyed by an
 * unguessable profile id; exposes only the class schedule.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await ctx.params;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: { linkedSection: { include: { program: true } } },
  });
  if (!profile) return new Response("Calendar not found", { status: 404 });

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentProfileId: profileId },
  });
  const overridden = new Set(enrollments.map((e) => e.subjectId));

  const homeSlots = profile.sectionId
    ? await prisma.timetableSlot.findMany({
        where: { sectionId: profile.sectionId },
        include: SLOT_INCLUDE,
      })
    : [];

  let slots = homeSlots.filter((s) => !overridden.has(s.assignment.subjectId));
  if (enrollments.length > 0) {
    const enrolledSlots = await prisma.timetableSlot.findMany({
      where: {
        OR: enrollments.map((e) => ({
          sectionId: e.sectionId,
          assignment: { subjectId: e.subjectId },
        })),
      },
      include: SLOT_INCLUDE,
    });
    slots = [...slots, ...enrolledSlots];
  }

  if (slots.length === 0) return new Response("Calendar not found", { status: 404 });

  const ics = buildWeekIcs(
    slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      title: `${s.assignment.subject.code} — ${s.assignment.subject.name}`,
      location: s.classroom.name,
      description: `Faculty: ${s.assignment.faculty.user.name ?? "TBA"} · ${s.section.program.name} Sec ${s.section.name}`,
    })),
    PERIOD_TIMES,
    "My Classes · ChalkZone"
  );

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="chalkzone-my-classes.ics"',
      "cache-control": "public, max-age=300",
    },
  });
}
