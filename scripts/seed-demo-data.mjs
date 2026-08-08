/**
 * Seed realistic demo data so every role's dashboard shows something.
 *
 * The role accounts (scripts/seed-demo-users.mjs) alone leave every module empty —
 * a recruiter clicking "Explore as Faculty" would land in a shell and conclude the
 * app does nothing, which is the opposite of what eight roles are meant to prove.
 *
 * Idempotent: safe to re-run. Everything keys off deterministic identifiers so a
 * second run updates rather than duplicating.
 *
 * ONLY run against the demo Supabase project. Every name here is invented.
 *
 *   node scripts/seed-demo-data.mjs
 */

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 }),
});

const demoEmail = (role) => `demo.${role.toLowerCase().replace(/_/g, '')}@chalkzone.demo`;

// Invented students. Deliberately varied CGPA and attendance so the analytics,
// eligibility filters and low-attendance warnings all have something to show.
const STUDENTS = [
  { name: 'Aarav Kulkarni', roll: 'MBA25001', cgpa: 8.6, attend: 0.92 },
  { name: 'Diya Raghunathan', roll: 'MBA25002', cgpa: 9.1, attend: 0.96 },
  { name: 'Kabir Anand', roll: 'MBA25003', cgpa: 7.4, attend: 0.71 },
  { name: 'Meera Vaidya', roll: 'MBA25004', cgpa: 8.9, attend: 0.88 },
  { name: 'Rohan Dsouza', roll: 'MBA25005', cgpa: 6.8, attend: 0.63 },
  { name: 'Sana Qureshi', roll: 'MBA25006', cgpa: 9.4, attend: 0.98 },
  { name: 'Vikram Iyer', roll: 'MBA25007', cgpa: 7.9, attend: 0.84 },
  { name: 'Ananya Bose', roll: 'MBA25008', cgpa: 8.2, attend: 0.79 },
  { name: 'Farhan Sheikh', roll: 'MBA25009', cgpa: 7.1, attend: 0.68 },
  { name: 'Tara Menon', roll: 'MBA25010', cgpa: 8.8, attend: 0.91 },
];

const SUBJECTS = [
  { code: 'MG501', name: 'Marketing Management', credits: 4, sem: 1 },
  { code: 'FN502', name: 'Financial Management', credits: 4, sem: 1 },
  { code: 'OP503', name: 'Operations & Supply Chain', credits: 3, sem: 1 },
  { code: 'HR504', name: 'Organisational Behaviour', credits: 3, sem: 1 },
  { code: 'AN505', name: 'Business Analytics', credits: 4, sem: 1 },
];

const gradeFor = (t) =>
  t >= 90 ? ['O', 10] : t >= 80 ? ['A+', 9] : t >= 70 ? ['A', 8] : t >= 60 ? ['B+', 7] : t >= 50 ? ['B', 6] : ['C', 5];

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000);

async function main() {
  // ── Users we seeded earlier ───────────────────────────────────────────────
  const users = Object.fromEntries(
    await Promise.all(
      ['STUDENT', 'PARENT', 'FACULTY', 'HR', 'MANAGER', 'ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'].map(
        async (r) => [r, await prisma.user.findUnique({ where: { email: demoEmail(r) } })]
      )
    )
  );

  const missing = Object.entries(users).filter(([, u]) => !u).map(([r]) => r);
  if (missing.length) {
    console.error('✗ Run seed-demo-users.mjs first. Missing: ' + missing.join(', '));
    process.exit(1);
  }

  // ── Programme, batch, section ─────────────────────────────────────────────
  const program = await prisma.program.upsert({
    where: { name: 'Master of Business Administration' },
    create: { name: 'Master of Business Administration', code: 'MBA', credits: 96, department: 'School of Business' },
    update: {},
  });

  const batch = await prisma.batch.upsert({
    where: { programId_label: { programId: program.id, label: '2025-2027' } },
    create: { programId: program.id, label: '2025-2027' },
    update: {},
  });

  const section = await prisma.programSection.upsert({
    where: { batchId_semester_name: { batchId: batch.id, semester: 1, name: 'A' } },
    create: { programId: program.id, batchId: batch.id, semester: 1, name: 'A', studentCount: STUDENTS.length },
    update: { studentCount: STUDENTS.length },
  });
  console.log('  ✓ programme, batch, section');

  // ── Subjects ──────────────────────────────────────────────────────────────
  const subjects = [];
  for (const s of SUBJECTS) {
    subjects.push(
      await prisma.subject.upsert({
        where: { programId_code: { programId: program.id, code: s.code } },
        create: { programId: program.id, code: s.code, name: s.name, credits: s.credits, semester: s.sem },
        update: { name: s.name, credits: s.credits, semester: s.sem },
      })
    );
  }
  console.log(`  ✓ ${subjects.length} subjects`);

  // ── Faculty profile for the demo faculty account ──────────────────────────
  const faculty = await prisma.facultyProfile.upsert({
    where: { userId: users.FACULTY.id },
    create: {
      userId: users.FACULTY.id,
      employeeCode: 'FAC-1001',
      department: 'School of Business',
      designation: 'Assistant Professor',
    },
    update: {},
  });

  // Teaching assignments so the faculty dashboard is not blank.
  for (const subj of subjects.slice(0, 3)) {
    await prisma.sectionCourseAssignment.upsert({
      where: { sectionId_subjectId: { sectionId: section.id, subjectId: subj.id } },
      create: { sectionId: section.id, subjectId: subj.id, facultyProfileId: faculty.id },
      update: { facultyProfileId: faculty.id },
    });
  }
  console.log('  ✓ faculty profile + teaching assignments');

  // ── Students ──────────────────────────────────────────────────────────────
  // The demo STUDENT account is the first row, so "Explore as Student" lands on a
  // populated profile rather than an empty one.
  const profiles = [];
  for (const [i, s] of STUDENTS.entries()) {
    const isDemoUser = i === 0;
    const user = isDemoUser
      ? users.STUDENT
      : await prisma.user.upsert({
          where: { email: `${s.roll.toLowerCase()}@chalkzone.demo` },
          create: { email: `${s.roll.toLowerCase()}@chalkzone.demo`, name: s.name, role: 'STUDENT' },
          update: { name: s.name },
        });

    if (isDemoUser) {
      await prisma.user.update({ where: { id: user.id }, data: { name: s.name } });
    }

    profiles.push(
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          rollNo: s.roll,
          program: program.name,
          batchId: batch.id,
          sectionId: section.id,
          section: 'A',
          admissionYear: 2025,
          currentSemester: 1,
          cgpa: s.cgpa,
        },
        update: { cgpa: s.cgpa, sectionId: section.id, batchId: batch.id },
      })
    );
  }
  console.log(`  ✓ ${profiles.length} students`);

  // ── Attendance + marks ────────────────────────────────────────────────────
  let att = 0;
  let mk = 0;
  for (const [i, p] of profiles.entries()) {
    const rate = STUDENTS[i].attend;
    for (const subj of subjects) {
      const total = 40;
      const attended = Math.round(total * rate);
      await prisma.attendance.upsert({
        where: { studentProfileId_subjectId_semester: { studentProfileId: p.id, subjectId: subj.id, semester: 1 } },
        create: {
          studentProfileId: p.id,
          subjectId: subj.id,
          semester: 1,
          totalClasses: total,
          attendedClasses: attended,
          percentage: Math.round((attended / total) * 1000) / 10,
        },
        update: { totalClasses: total, attendedClasses: attended, percentage: Math.round((attended / total) * 1000) / 10 },
      });
      att++;

      // Marks loosely track CGPA so the analytics look coherent rather than random.
      const base = STUDENTS[i].cgpa * 9;
      const jitter = ((i + subj.code.charCodeAt(2)) % 9) - 4;
      const internal = Math.max(10, Math.min(30, Math.round(base * 0.3 + jitter)));
      const external = Math.max(20, Math.min(70, Math.round(base * 0.7 + jitter)));
      const totalMarks = internal + external;
      const [grade, gp] = gradeFor(totalMarks);

      await prisma.marks.upsert({
        where: { studentProfileId_subjectId_semester: { studentProfileId: p.id, subjectId: subj.id, semester: 1 } },
        create: { studentProfileId: p.id, subjectId: subj.id, semester: 1, internalMarks: internal, externalMarks: external, totalMarks, grade, gradePoint: gp },
        update: { internalMarks: internal, externalMarks: external, totalMarks, grade, gradePoint: gp },
      });
      mk++;
    }
  }
  console.log(`  ✓ ${att} attendance rows, ${mk} mark rows`);

  // ── Ticket categories + tickets ───────────────────────────────────────────
  const categories = {};
  for (const [name, sla] of [['IT Support', 24], ['Academics', 48], ['Placements', 72], ['Finance', 48], ['Hostel', 24]]) {
    categories[name] = await prisma.ticketCategory.upsert({
      where: { name },
      create: { name, slaHours: sla, description: `${name} requests and issues` },
      update: {},
    });
  }

  // Spread across statuses and priorities so the kanban board is actually populated.
  const TICKETS = [
    ['Projector not working in Room A-301', 'The HDMI port seems damaged. Session had to move rooms.', 'IT Support', 'OPEN', 'HIGH', 1],
    ['Wi-Fi drops during afternoon sessions', 'Repeated disconnects between 2pm and 4pm in the east wing.', 'IT Support', 'IN_PROGRESS', 'MEDIUM', 3],
    ['Attendance not reflecting for MG501', 'Marked present on Tuesday but the record shows absent.', 'Academics', 'OPEN', 'MEDIUM', 2],
    ['Request for transcript copy', 'Needed for an internship application deadline next week.', 'Academics', 'RESOLVED', 'LOW', 9],
    ['Query about placement eligibility', 'Does a 7.1 CGPA meet the cutoff for the analytics roles?', 'Placements', 'WAITING_FOR_STUDENT', 'MEDIUM', 5],
    ['Fee receipt not generated', 'Payment cleared on the 3rd but no receipt in the portal.', 'Finance', 'IN_PROGRESS', 'HIGH', 4],
    ['Hostel room change request', 'Requesting a move to the quieter block before exams.', 'Hostel', 'OPEN', 'LOW', 6],
    ['Library access card not working', 'Card reader rejects it at the main entrance.', 'IT Support', 'CLOSED', 'LOW', 14],
    ['Marks discrepancy in FN502', 'Internal shows 22 but the answer sheet totalled 26.', 'Academics', 'OPEN', 'CRITICAL', 1],
  ];

  let tk = 0;
  for (const [title, description, cat, status, priority, ago] of TICKETS) {
    const existing = await prisma.ticket.findFirst({ where: { title } });
    const data = {
      title,
      description,
      status,
      priority,
      categoryId: categories[cat].id,
      creatorId: users.STUDENT.id,
      assigneeId: cat === 'Placements' ? users.MANAGER.id : users.ADMIN.id,
      createdAt: daysAgo(ago),
      slaDeadline: new Date(daysAgo(ago).getTime() + categories[cat].slaHours * 3_600_000),
    };
    if (existing) await prisma.ticket.update({ where: { id: existing.id }, data });
    else await prisma.ticket.create({ data });
    tk++;
  }
  console.log(`  ✓ ${Object.keys(categories).length} ticket categories, ${tk} tickets`);

  // ── Placements ────────────────────────────────────────────────────────────
  const COMPANIES = [
    ['Northwind Analytics', 'Data and decision science consultancy', 'https://example.com/northwind'],
    ['Bluepeak Consulting', 'Strategy and operations advisory', 'https://example.com/bluepeak'],
    ['Kestrel Financial', 'Investment research and advisory', 'https://example.com/kestrel'],
  ];
  const companies = {};
  for (const [name, description, website] of COMPANIES) {
    companies[name] = await prisma.company.upsert({
      where: { name },
      create: { name, description, website },
      update: { description, website },
    });
  }

  const JOBS = [
    ['Northwind Analytics', 'Business Analyst', 'Work with client data teams on forecasting and reporting.', 7.5, 21],
    ['Northwind Analytics', 'Data Analyst (Intern)', 'Six-month internship supporting the analytics practice.', 7.0, 14],
    ['Bluepeak Consulting', 'Associate Consultant', 'Client-facing problem solving across operations engagements.', 8.0, 30],
    ['Kestrel Financial', 'Research Associate', 'Equity research support and sector coverage.', 8.5, 10],
  ];

  const postings = [];
  for (const [company, title, description, minCgpa, dueIn] of JOBS) {
    const existing = await prisma.jobPosting.findFirst({ where: { title, companyId: companies[company].id } });
    const data = {
      companyId: companies[company].id,
      title,
      description,
      eligibility: { minCgpa, programmes: ['MBA'], maxBacklogs: 0 },
      deadline: daysAhead(dueIn),
      isActive: true,
    };
    postings.push(existing ? await prisma.jobPosting.update({ where: { id: existing.id }, data }) : await prisma.jobPosting.create({ data }));
  }

  // Applications at varied stages so the pipeline view has movement in it.
  const STAGES = ['APPLIED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'];
  let apps = 0;
  for (const [i, p] of profiles.entries()) {
    if (STUDENTS[i].cgpa < 7.0) continue; // respect the eligibility story
    const posting = postings[i % postings.length];
    await prisma.jobApplication.upsert({
      where: { jobPostingId_studentProfileId: { jobPostingId: posting.id, studentProfileId: p.id } },
      create: { jobPostingId: posting.id, studentProfileId: p.id, status: STAGES[i % STAGES.length], appliedAt: daysAgo(i + 2) },
      update: { status: STAGES[i % STAGES.length] },
    });
    apps++;
  }
  console.log(`  ✓ ${Object.keys(companies).length} companies, ${postings.length} postings, ${apps} applications`);

  // ── Announcements ─────────────────────────────────────────────────────────
  const ANNOUNCEMENTS = [
    ['Semester 1 mid-term schedule published', '<p>The mid-term timetable is now available. Please check your section timings carefully.</p>', 'ACADEMICS', 2],
    ['Northwind Analytics campus drive', '<p>Pre-placement talk on Thursday, followed by the aptitude round on Friday.</p>', 'PLACEMENTS', 4],
    ['Library extended hours during exams', '<p>The library will stay open until 11pm from next Monday.</p>', 'EVENTS', 6],
    ['Attendance shortfall notice', '<p>Students below 75% attendance must meet their mentor this week.</p>', 'ALERTS', 1],
  ];
  for (const [title, contentHtml, category, ago] of ANNOUNCEMENTS) {
    const existing = await prisma.announcement.findFirst({ where: { title } });
    if (existing) continue;
    const a = await prisma.announcement.create({
      data: { title, contentHtml, category, authorId: users.ADMIN.id, createdAt: daysAgo(ago) },
    });
    // A single all-null target row means campus-wide.
    await prisma.announcementTarget.create({ data: { announcementId: a.id } });
  }
  console.log(`  ✓ ${ANNOUNCEMENTS.length} announcements`);

  // ── Appraisal cycle ───────────────────────────────────────────────────────
  const existingCycle = await prisma.appraisalCycle.findFirst({ where: { name: 'Annual Appraisal 2026-27' } });
  if (!existingCycle) {
    await prisma.appraisalCycle.create({
      data: { name: 'Annual Appraisal 2026-27', startDate: daysAgo(20), endDate: daysAhead(25), status: 'OPEN' },
    });
  }
  console.log('  ✓ appraisal cycle (open)');
}

main()
  .catch((err) => {
    console.error('✗', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
