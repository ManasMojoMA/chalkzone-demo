import { Prisma } from "@prisma/client";

// Ticket Types
export type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    category: true;
    creator: true;
    assignee: true;
  };
}>;

export type TicketDetail = Prisma.TicketGetPayload<{
  include: {
    category: true;
    creator: true;
    assignee: true;
    messages: { include: { sender: true } };
    attachments: { include: { uploadedBy: true } };
    participants: { include: { user: true; addedBy: true } };
    internalNotes: { include: { author: true; attachments: { include: { uploadedBy: true } } } };
  };
}>;

export type CategoryWithSla = Prisma.TicketCategoryGetPayload<{
  include: {
    escalationUser: true;
    staffOwners: { include: { user: true } };
  };
}>;

// Job Posting Types
export type JobPostingWithRelations = Prisma.JobPostingGetPayload<{
  include: {
    company: true;
    applications: true;
  };
}>;

export type JobApplicationWithRelations = Prisma.JobApplicationGetPayload<{
  include: {
    student: {
      include: {
        user: true;
      };
    };
    jobPosting: true;
  };
}>;

// Internship Types
export type InternshipWithRelations = Prisma.InternshipGetPayload<{}>;

// Marks & Performance Types
export type MarksWithRelations = Prisma.MarksGetPayload<{
  include: {
    student: {
      include: {
        user: true;
      };
    };
    subject: true;
  };
}>;

// Subject & Programme Types
export type SubjectWithProgram = Prisma.SubjectGetPayload<{
  include: {
    program: true;
  };
}>;

// Appraisal Types
export type FacultySubmissionWithRelations = Prisma.FacultySubmissionGetPayload<{
  include: {
    faculty: {
      include: {
        user: true;
      };
    };
    evaluation: true;
  };
}>;
