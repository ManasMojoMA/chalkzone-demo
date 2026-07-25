/**
 * Idempotent development seed. Run with: npm run db:seed
 * Consolidates the mock data previously scattered across per-page
 * "Add Mock Data" server actions.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
type UserRole = "STUDENT" | "FACULTY" | "HR" | "MANAGER" | "ADMIN" | "SUPER_ADMIN" | "PARENT" | "EXECUTIVE";
interface DevUser { id: string; email: string; name: string; role: UserRole; }
const DEV_USERS: Record<UserRole, DevUser> = {
  STUDENT: { id: "dev-student-001", email: "student@university.edu", name: "Aarav Sharma", role: "STUDENT" },
  FACULTY: { id: "dev-faculty-001", email: "faculty@university.edu", name: "Dr. Priya Mehta", role: "FACULTY" },
  HR: { id: "dev-hr-001", email: "hr@company.com", name: "Riya Kapoor", role: "HR" },
  MANAGER: { id: "dev-manager-001", email: "manager@university.edu", name: "Prof. Vikram Singh", role: "MANAGER" },
  ADMIN: { id: "dev-admin-001", email: "admin@university.edu", name: "Neha Gupta", role: "ADMIN" },
  SUPER_ADMIN: { id: "dev-superadmin-001", email: "superadmin@university.edu", name: "Rajesh Kumar", role: "SUPER_ADMIN" },
  PARENT: { id: "dev-parent-001", email: "parent@university.edu", name: "Suresh Sharma", role: "PARENT" },
  EXECUTIVE: { id: "dev-executive-001", email: "executive@university.edu", name: "Dr. Anil Desai", role: "EXECUTIVE" },
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding development data...");

  // ─── Users + profiles ─────────────────────────────────────────────────
  for (const devUser of Object.values(DEV_USERS)) {
    await prisma.user.upsert({
      where: { email: devUser.email },
      update: { role: devUser.role, name: devUser.name },
      create: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        role: devUser.role,
      },
    });
  }

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: DEV_USERS.STUDENT.id },
    update: {},
    create: {
      userId: DEV_USERS.STUDENT.id,
      rollNo: "CS2026-001",
      program: "B.Tech CSE",
      admissionYear: 2024,
      currentSemester: 5,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@university.edu" },
    update: {},
    create: {
      id: "dev-student-002",
      email: "student2@university.edu",
      name: "Rohit Verma",
      role: "STUDENT",
    },
  });

  const studentProfile2 = await prisma.studentProfile.upsert({
    where: { userId: student2.id },
    update: {},
    create: {
      userId: student2.id,
      rollNo: "CS2026-002",
      program: "B.Tech CSE",
      admissionYear: 2024,
      currentSemester: 5,
    },
  });

  await prisma.facultyProfile.upsert({
    where: { userId: DEV_USERS.FACULTY.id },
    update: {},
    create: {
      userId: DEV_USERS.FACULTY.id,
      employeeCode: "FAC-001",
      department: "CSE",
      designation: "Assistant Professor",
    },
  });

  // ─── Academics: programme, subjects, attendance, marks ─────────────────
  const program = await prisma.program.upsert({
    where: { code: "BTECH-CSE" },
    update: {},
    create: { code: "BTECH-CSE", name: "B.Tech Computer Science", credits: 160, department: "CSE" },
  });

  const subjectDefs = [
    { code: "CS501", name: "Data Structures", credits: 4 },
    { code: "CS502", name: "Database Systems", credits: 4 },
    { code: "CS503", name: "Operating Systems", credits: 3 },
  ];

  const subjects = [];
  for (const def of subjectDefs) {
    subjects.push(
      await prisma.subject.upsert({
        where: { programId_code: { programId: program.id, code: def.code } },
        update: {},
        create: { ...def, programId: program.id },
      })
    );
  }

  const attendanceRows = [
    { profile: studentProfile, subject: subjects[0], total: 20, attended: 18 },
    { profile: studentProfile, subject: subjects[1], total: 20, attended: 15 },
    { profile: studentProfile, subject: subjects[2], total: 18, attended: 12 },
    { profile: studentProfile2, subject: subjects[0], total: 20, attended: 12 },
    { profile: studentProfile2, subject: subjects[1], total: 20, attended: 17 },
  ];

  for (const row of attendanceRows) {
    await prisma.attendance.upsert({
      where: {
        studentProfileId_subjectId_semester: {
          studentProfileId: row.profile.id,
          subjectId: row.subject.id,
          semester: 5,
        },
      },
      update: {},
      create: {
        studentProfileId: row.profile.id,
        subjectId: row.subject.id,
        semester: 5,
        totalClasses: row.total,
        attendedClasses: row.attended,
        percentage: (row.attended / row.total) * 100,
      },
    });
  }

  const marksRows = [
    { profile: studentProfile, subject: subjects[0], internal: 25, external: 55, practical: 10, grade: "O", gp: 10 },
    { profile: studentProfile, subject: subjects[1], internal: 20, external: 50, practical: 15, grade: "A+", gp: 9 },
    { profile: studentProfile2, subject: subjects[0], internal: 18, external: 42, practical: 12, grade: "A", gp: 8 },
  ];

  for (const row of marksRows) {
    await prisma.marks.upsert({
      where: {
        studentProfileId_subjectId_semester: {
          studentProfileId: row.profile.id,
          subjectId: row.subject.id,
          semester: 5,
        },
      },
      update: {},
      create: {
        studentProfileId: row.profile.id,
        subjectId: row.subject.id,
        semester: 5,
        internalMarks: row.internal,
        externalMarks: row.external,
        practicalMarks: row.practical,
        totalMarks: row.internal + row.external + row.practical,
        grade: row.grade,
        gradePoint: row.gp,
      },
    });
  }

  // Credit-weighted CGPA for each seeded student
  for (const profile of [studentProfile, studentProfile2]) {
    const marks = await prisma.marks.findMany({
      where: { studentProfileId: profile.id },
      include: { subject: true },
    });
    const totalCredits = marks.reduce((acc, m) => acc + m.subject.credits, 0);
    const totalPoints = marks.reduce((acc, m) => acc + m.subject.credits * m.gradePoint, 0);
    const cgpa = totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0;
    await prisma.studentProfile.update({ where: { id: profile.id }, data: { cgpa } });
  }

  // ─── Tickets ───────────────────────────────────────────────────────────
  const categoryDefs = [
    { id: "cat-it", name: "IT", description: "IT Support" },
    { id: "cat-finance", name: "Finance", description: "Fee & Finance" },
    { id: "cat-academics", name: "Academics", description: "Academics" },
    { id: "cat-placements", name: "Placements", description: "Placements" },
    { id: "cat-hostel", name: "Hostel", description: "Hostel & Facilities" },
  ];
  for (const cat of categoryDefs) {
    await prisma.ticketCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  if ((await prisma.ticket.count()) === 0) {
    await prisma.ticket.create({
      data: {
        title: "Wifi not working in hostel block C",
        description: "I am unable to connect to the campus wifi since morning. It shows authentication error.",
        status: "OPEN",
        categoryId: "cat-it",
        creatorId: DEV_USERS.STUDENT.id,
      },
    });
    await prisma.ticket.create({
      data: {
        title: "Fee receipt not generated",
        description: "Paid the semester fee yesterday but receipt is not available on dashboard. Payment ID is PAY123456.",
        status: "IN_PROGRESS",
        categoryId: "cat-finance",
        creatorId: DEV_USERS.STUDENT.id,
        assigneeId: DEV_USERS.ADMIN.id,
      },
    });
  }

  // ─── Placements ────────────────────────────────────────────────────────
  const google = await prisma.company.upsert({
    where: { name: "Google" },
    update: {},
    create: { name: "Google", description: "Tech giant", website: "https://google.com" },
  });
  const microsoft = await prisma.company.upsert({
    where: { name: "Microsoft" },
    update: {},
    create: { name: "Microsoft", description: "Empowering every person", website: "https://microsoft.com" },
  });

  if ((await prisma.jobPosting.count()) === 0) {
    const inOneMonth = new Date();
    inOneMonth.setMonth(inOneMonth.getMonth() + 1);
    const inTwoMonths = new Date();
    inTwoMonths.setMonth(inTwoMonths.getMonth() + 2);

    await prisma.jobPosting.create({
      data: { companyId: google.id, title: "Software Engineer", description: "Join the search team.", isActive: true, deadline: inOneMonth },
    });
    await prisma.jobPosting.create({
      data: { companyId: microsoft.id, title: "Program Manager", description: "Lead Office 365 initiatives.", isActive: true, deadline: inTwoMonths },
    });
  }

  // ─── Appraisal cycle ───────────────────────────────────────────────────
  const openCycle = await prisma.appraisalCycle.findFirst({ where: { status: "OPEN" } });
  if (!openCycle) {
    const cycleEnd = new Date();
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    await prisma.appraisalCycle.create({
      data: { name: "Annual Faculty Appraisal 2026", startDate: new Date(), endDate: cycleEnd, status: "OPEN" },
    });
  }

  // ─── Knowledge base ────────────────────────────────────────────────────
  if ((await prisma.resourceDocument.count()) === 0) {
    await prisma.resourceDocument.createMany({
      data: [
        {
          title: "Attendance Policy",
          content:
            "Minimum 75% attendance is required in each subject to be eligible for final exams. If attendance falls below 65%, the student may be detained. Condonation up to 10% may be granted for medical reasons with valid documentation. Source: University Handbook 2024-25, Section 4.2.",
        },
        {
          title: "Grading and CGPA Rules",
          content:
            "Grades: O (>=90, 10 points), A+ (>=80, 9), A (>=70, 8), B+ (>=60, 7), B (>=50, 6), F (<50, 0). SGPA = sum(credits x grade points) / sum(credits) per semester. CGPA is the credit-weighted average across all semesters, reported to 2 decimal places.",
        },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
