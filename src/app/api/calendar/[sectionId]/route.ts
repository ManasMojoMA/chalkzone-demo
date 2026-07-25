import prisma from "@/lib/prisma";
import { buildWeekIcs, PERIOD_TIMES } from "@/lib/ics";

/**
 * Live iCalendar feed for one section's weekly timetable.
 *
 * Subscribing to this URL (Google Calendar → "From URL", Outlook, Apple)
 * imports every class as a weekly-recurring event AND keeps it in sync —
 * when the timetable changes, calendars refresh automatically. The URL is
 * public but keyed by an unguessable section id; it exposes only the class
 * schedule (no personal data).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await ctx.params;

  const section = await prisma.programSection.findUnique({
    where: { id: sectionId },
    include: { program: true, batch: { select: { label: true } } },
  });
  if (!section) return new Response("Calendar not found", { status: 404 });

  const slots = await prisma.timetableSlot.findMany({
    where: { sectionId },
    include: {
      assignment: {
        include: {
          subject: true,
          faculty: { include: { user: { select: { name: true } } } },
        },
      },
      classroom: true,
    },
  });

  const ics = buildWeekIcs(
    slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      title: `${s.assignment.subject.code} — ${s.assignment.subject.name}`,
      location: s.classroom.name,
      description: `Faculty: ${s.assignment.faculty.user.name ?? "TBA"} · ${section.program.name} ${section.batch.label} Sem ${section.semester} Sec ${section.name}`,
    })),
    PERIOD_TIMES,
    `${section.program.name} ${section.name} · ChalkZone`
  );

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="chalkzone-${section.name.toLowerCase()}.ics"`,
      // calendar apps poll this URL; let them cache briefly
      "cache-control": "public, max-age=300",
    },
  });
}
