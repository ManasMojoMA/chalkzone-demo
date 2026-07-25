import { z } from "zod";

// Tickets
export const createTicketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(10, "Please describe the issue in detail").max(2000),
  categoryId: z.string().min(1, "Please select a category"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export const internalNoteSchema = z.object({
  content: z.string().min(1, "Note cannot be empty").max(4000),
});

export const categorySlaSchema = z.object({
  slaHours: z.coerce.number().int().min(1, "SLA must be at least 1 hour").max(720, "SLA cannot exceed 30 days"),
  escalationRole: z.enum(["FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN"]).nullable(),
  escalationUserId: z.string().nullable(),
});

// Resume Builder — drafts must be saveable while incomplete, so every field is
// optional; format rules only apply when a value is actually present. Field
// names match the editor's data shape (name/email/phone/address).
export const personalDetailsSchema = z
  .object({
    name: z.string().max(100, "Name is too long").optional().or(z.literal("")),
    email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
    phone: z.string().regex(/^\+?[\d\s-]{7,15}$/, "Invalid phone number").optional().or(z.literal("")),
    address: z.string().max(200, "Address is too long").optional().or(z.literal("")),
  })
  .passthrough();

// Placements & Internships
export const logInternshipSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  designation: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(d => d.endDate >= d.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const createJobPostingSchema = z.object({
  companyId: z.string().min(1, "Select a company"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(10, "Description must be detailed").max(5000),
  deadline: z.coerce.date().refine(d => d > new Date(), "Deadline must be in the future"),
});

// Marks
export const updateMarksSchema = z.object({
  internalMarks: z.number().int().min(0).max(40),
  externalMarks: z.number().int().min(0).max(60),
  practicalMarks: z.number().int().min(0).max(50),
});

// Appraisals
export const appraisalSubmissionSchema = z.object({
  teachingPoints: z.coerce.number().min(0).max(10),
  researchPoints: z.coerce.number().min(0).max(10),
  adminPoints: z.coerce.number().min(0).max(10),
  notes: z.string().max(2000).optional(),
});

export const evaluationSchema = z.object({
  finalScore: z.coerce.number().min(0).max(10),
  evaluatorNotes: z.string().max(2000).optional(),
});
