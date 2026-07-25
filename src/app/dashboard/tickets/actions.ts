"use server"

import prisma from "@/lib/prisma"
import { TicketStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { isStaff, requireRole, requireUser } from "@/lib/session"
import { createTicketSchema, internalNoteSchema, categorySlaSchema } from "@/lib/validations"
import { notify, userIdsByRole } from "@/lib/notify"
import {
  createAdminClient,
  TICKET_ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/supabase/admin"

const STAFF_ROLES = ["FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const

// ─── Categories & SLA settings ──────────────────────────────────────────────

export async function fetchCategories() {
  await requireUser()
  return await prisma.ticketCategory.findMany()
}

export async function fetchCategoriesWithSla() {
  await requireRole("ADMIN", "SUPER_ADMIN")
  return await prisma.ticketCategory.findMany({
    include: {
      escalationUser: true,
      staffOwners: { include: { user: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function updateCategorySla(categoryId: string, data: unknown) {
  // SLA policy is reserved for the master admin
  await requireRole("SUPER_ADMIN")

  const parsed = categorySlaSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message || "Invalid SLA settings" }
  }

  await prisma.ticketCategory.update({
    where: { id: categoryId },
    data: {
      slaHours: parsed.data.slaHours,
      escalationRole: parsed.data.escalationRole,
      escalationUserId: parsed.data.escalationUserId,
    },
  })
  revalidatePath("/dashboard/tickets")
  return { success: true as const }
}

export async function setCategoryOwners(categoryId: string, userIds: string[]) {
  await requireRole("ADMIN", "SUPER_ADMIN")

  try {
    await prisma.$transaction([
      prisma.staffCategoryOwnership.deleteMany({ where: { categoryId } }),
      prisma.staffCategoryOwnership.createMany({
        data: userIds.map((userId) => ({ categoryId, userId })),
        skipDuplicates: true,
      }),
    ])
    revalidatePath("/dashboard/tickets")
    return { success: true as const }
  } catch (e) {
    console.error("setCategoryOwners failed:", e)
    return { success: false as const, error: "Failed to save category owners" }
  }
}

// ─── Ticket CRUD ────────────────────────────────────────────────────────────

export async function createTicket(data: unknown) {
  const user = await requireUser()

  // Tickets are raised by students only; staff roles exist to resolve them.
  if (isStaff(user)) {
    return { success: false as const, error: "Support tickets are raised by students. Staff resolve and manage them." }
  }

  const parsed = createTicketSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message || "Validation failed" }
  }
  const validData = parsed.data

  const category = await prisma.ticketCategory.findUnique({ where: { id: validData.categoryId } })
  if (!category) {
    return { success: false as const, error: "Category not found" }
  }

  const slaDeadline = new Date(Date.now() + category.slaHours * 3_600_000)

  const ticket = await prisma.ticket.create({
    data: {
      title: validData.title,
      description: validData.description,
      categoryId: validData.categoryId,
      priority: validData.priority,
      creatorId: user.id,
      status: "OPEN",
      slaDeadline,
    },
  })
  revalidatePath("/dashboard/tickets")
  return { success: true as const, ticket }
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const user = await requireUser()

  // Students may only change status on their own tickets
  if (!isStaff(user)) {
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!existing || existing.creatorId !== user.id) {
      throw new Error("You can only update your own tickets.")
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status },
  })
  revalidatePath("/dashboard/tickets")
  return ticket
}

export async function updateTicketPriority(ticketId: string, priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") {
  await requireRole(...STAFF_ROLES)
  try {
    await prisma.ticket.update({ where: { id: ticketId }, data: { priority } })
    revalidatePath("/dashboard/tickets")
    return { success: true as const }
  } catch (e) {
    console.error("updateTicketPriority failed:", e)
    return { success: false as const, error: "Failed to update priority" }
  }
}

export async function addTicketMessage(ticketId: string, content: string) {
  const user = await requireUser()

  if (!isStaff(user)) {
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!existing || existing.creatorId !== user.id) {
      throw new Error("You can only reply to your own tickets.")
    }
  }

  if (!content.trim()) {
    return { success: false as const, error: "Message cannot be empty" }
  }

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      content: content.trim(),
      senderId: user.id,
      isAi: false,
    },
    include: { ticket: true },
  })

  await notify(
    [message.ticket.creatorId, message.ticket.assigneeId ?? ""],
    {
      type: "TICKET",
      title: `New reply on "${message.ticket.title}"`,
      body: content.trim().slice(0, 120),
      link: "/dashboard/tickets",
    },
    user.id
  )

  revalidatePath("/dashboard/tickets")
  return { success: true as const, message }
}

// ─── Fetching ───────────────────────────────────────────────────────────────

/** Marks freshly SLA-breached tickets (once) and notifies the category's
 *  escalation target — a specific person if configured, else everyone
 *  holding the category's escalation role. */
async function stampNewEscalations() {
  const breached = await prisma.ticket.findMany({
    where: {
      escalatedAt: null,
      slaDeadline: { lt: new Date() },
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_STUDENT"] },
    },
    include: { category: true },
  })
  if (breached.length === 0) return

  await prisma.ticket.updateMany({
    where: { id: { in: breached.map((t) => t.id) } },
    data: { escalatedAt: new Date() },
  })

  for (const t of breached) {
    let targets: string[] = []
    if (t.category.escalationUserId) {
      targets = [t.category.escalationUserId]
    } else if (t.category.escalationRole) {
      targets = await userIdsByRole(t.category.escalationRole as Parameters<typeof userIdsByRole>[0])
    }
    if (t.assigneeId) targets.push(t.assigneeId)
    await notify(targets, {
      type: "TICKET",
      title: `SLA breached: "${t.title}"`,
      body: `${t.category.name} ticket exceeded its ${t.category.slaHours}h SLA and has been escalated.`,
      link: "/dashboard/tickets",
    })
  }
}

export async function fetchStudentTickets() {
  const user = await requireUser()
  return await prisma.ticket.findMany({
    where: { creatorId: user.id },
    include: {
      category: true,
      creator: true,
      assignee: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

/** Staff queue model:
 *  - FACULTY / HR / MANAGER see tickets assigned to them, unassigned tickets
 *    in categories they own, and tickets where they're tagged as SPOC.
 *  - ADMIN / SUPER_ADMIN default to the same "my queue" but may pass
 *    scope="all" for full oversight (prevents tickets becoming invisible).
 *  Reassigning a ticket therefore removes it from the old assignee's queue. */
export async function fetchAllTickets(scope: "mine" | "all" = "mine") {
  const user = await requireRole(...STAFF_ROLES)
  await stampNewEscalations()

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
  const where =
    isAdmin && scope === "all"
      ? {}
      : {
          OR: [
            { assigneeId: user.id },
            {
              assigneeId: null,
              category: { staffOwners: { some: { userId: user.id } } },
            },
            { participants: { some: { userId: user.id } } },
            // Admins also keep unassigned tickets of unowned categories in
            // their queue so new tickets always surface somewhere
            ...(isAdmin ? [{ assigneeId: null }] : []),
          ],
        }

  return await prisma.ticket.findMany({
    where,
    include: {
      category: true,
      creator: true,
      assignee: true,
    },
    orderBy: { createdAt: "desc" },
  })
}

/** Full detail for the ticket sheet. Students only see their own tickets and
 *  never receive internal notes or internal attachments. */
export async function getTicketDetail(ticketId: string) {
  const user = await requireUser()
  const staff = isStaff(user)

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      category: true,
      creator: true,
      assignee: true,
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "asc" } },
      participants: { include: { user: true, addedBy: true }, orderBy: { createdAt: "asc" } },
      internalNotes: {
        include: { author: true, attachments: { include: { uploadedBy: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!ticket) return null
  if (!staff && ticket.creatorId !== user.id) return null

  if (!staff) {
    // Strip everything internal before it crosses to the client
    return {
      ...ticket,
      internalNotes: [],
      participants: [],
      attachments: ticket.attachments.filter((a) => a.internalNoteId === null),
    }
  }
  return ticket
}

// ─── Internal collaboration (staff only) ────────────────────────────────────

export async function addInternalNote(ticketId: string, data: unknown) {
  const user = await requireRole(...STAFF_ROLES)

  const parsed = internalNoteSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues?.[0]?.message || "Invalid note" }
  }

  const note = await prisma.ticketInternalNote.create({
    data: { ticketId, authorId: user.id, content: parsed.data.content },
  })
  revalidatePath("/dashboard/tickets")
  return { success: true as const, note }
}

export async function getStaffUsers() {
  await requireRole(...STAFF_ROLES)
  return await prisma.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })
}

export async function addParticipant(ticketId: string, userId: string) {
  const user = await requireRole(...STAFF_ROLES)

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target || !STAFF_ROLES.includes(target.role as (typeof STAFF_ROLES)[number])) {
    return { success: false as const, error: "Only staff members can be tagged as SPOCs" }
  }

  await prisma.ticketParticipant.upsert({
    where: { ticketId_userId: { ticketId, userId } },
    update: {},
    create: { ticketId, userId, addedById: user.id },
  })

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true } })
  await notify([userId], {
    type: "TICKET",
    title: `${user.name ?? "A colleague"} tagged you as SPOC`,
    body: ticket ? `Ticket: "${ticket.title}" — your input is needed in the internal discussion.` : undefined,
    link: "/dashboard/tickets",
  })

  revalidatePath("/dashboard/tickets")
  return { success: true as const }
}

export async function removeParticipant(ticketId: string, userId: string) {
  const user = await requireRole(...STAFF_ROLES)

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { success: false as const, error: "Ticket not found" }

  // Only the assigned SPOC (or an admin) may remove tagged participants
  const isAssignee = ticket.assigneeId === user.id
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN"
  if (!isAssignee && !isAdmin) {
    return { success: false as const, error: "Only the assigned SPOC or an admin can remove participants" }
  }

  await prisma.ticketParticipant.deleteMany({ where: { ticketId, userId } })
  revalidatePath("/dashboard/tickets")
  return { success: true as const }
}

/** Every active staff member is assignable; owners of the ticket's category
 *  are pinned to the top of the list. (Previously only owners+admins were
 *  offered, which made most staff impossible to assign — reported as
 *  "reassign not working".) */
export async function getReassignmentCandidates(ticketId: string) {
  await requireRole(...STAFF_ROLES)

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { categoryId: true },
  })
  if (!ticket) return []

  const [owners, staff] = await Promise.all([
    prisma.staffCategoryOwnership.findMany({
      where: { categoryId: ticket.categoryId },
      select: { userId: true },
    }),
    prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])
  const ownerIds = new Set(owners.map((o) => o.userId))

  return staff
    .map((s) => ({ ...s, ownsCategory: ownerIds.has(s.id) }))
    .sort((a, b) => Number(b.ownsCategory) - Number(a.ownsCategory))
}

export async function reassignTicket(ticketId: string, assigneeId: string) {
  await requireRole(...STAFF_ROLES)

  const target = await prisma.user.findUnique({ where: { id: assigneeId } })
  if (!target || !target.isActive || !STAFF_ROLES.includes(target.role as (typeof STAFF_ROLES)[number])) {
    return { success: false as const, error: "Invalid assignee" }
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assigneeId,
      status: "IN_PROGRESS",
    },
  })

  await notify([assigneeId], {
    type: "TICKET",
    title: "A ticket was assigned to you",
    body: `"${updated.title}" is now your responsibility.`,
    link: "/dashboard/tickets",
  })

  revalidatePath("/dashboard/tickets")
  return { success: true as const }
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function uploadTicketAttachment(formData: FormData) {
  const user = await requireUser()
  const staff = isStaff(user)

  const ticketId = formData.get("ticketId") as string
  const internalNoteId = (formData.get("internalNoteId") as string) || null
  const file = formData.get("file") as File | null

  if (!ticketId || !file) {
    return { success: false as const, error: "Missing file or ticket" }
  }
  if (file.size === 0) {
    return { success: false as const, error: "File is empty" }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { success: false as const, error: "File exceeds the 10MB limit" }
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { success: false as const, error: "Ticket not found" }

  // Students: only their own tickets, and never into the internal thread
  if (!staff && (ticket.creatorId !== user.id || internalNoteId)) {
    return { success: false as const, error: "Not allowed" }
  }
  if (internalNoteId) {
    const note = await prisma.ticketInternalNote.findUnique({ where: { id: internalNoteId } })
    if (!note || note.ticketId !== ticketId) {
      return { success: false as const, error: "Invalid internal note" }
    }
  }

  const safeName = file.name.replace(/[^\w.\-()\[\] ]+/g, "_").slice(0, 120)
  const storagePath = `${ticketId}/${crypto.randomUUID()}-${safeName}`

  const supabase = createAdminClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(TICKET_ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream" })
  if (uploadError) {
    console.error("Attachment upload failed:", uploadError)
    return { success: false as const, error: "Upload failed. Please try again." }
  }

  const attachment = await prisma.ticketAttachment.create({
    data: {
      ticketId,
      internalNoteId,
      storagePath,
      filename: safeName,
      sizeBytes: file.size,
      uploadedById: user.id,
    },
  })
  revalidatePath("/dashboard/tickets")
  return { success: true as const, attachment }
}

export async function getAttachmentUrl(attachmentId: string) {
  const user = await requireUser()
  const staff = isStaff(user)

  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: true },
  })
  if (!attachment) return { success: false as const, error: "Attachment not found" }

  const ownTicket = attachment.ticket.creatorId === user.id
  if (!staff && (!ownTicket || attachment.internalNoteId !== null)) {
    return { success: false as const, error: "Not allowed" }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(TICKET_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storagePath, 300) // 5 minutes
  if (error || !data?.signedUrl) {
    console.error("Signed URL failed:", error)
    return { success: false as const, error: "Could not generate download link" }
  }
  return { success: true as const, url: data.signedUrl, filename: attachment.filename }
}

// ─── Dev seeding ────────────────────────────────────────────────────────────

export async function seedMockTickets() {
  await requireUser()
  let categories = await prisma.ticketCategory.findMany()
  if (categories.length === 0) {
    await prisma.ticketCategory.createMany({
      data: [
        { id: "cat-it", name: "IT", description: "IT Support" },
        { id: "cat-finance", name: "Finance", description: "Fee & Finance" },
        { id: "cat-academics", name: "Academics", description: "Academics" },
        { id: "cat-placements", name: "Placements", description: "Placements" },
        { id: "cat-hostel", name: "Hostel", description: "Hostel & Facilities" },
      ],
    })
    categories = await prisma.ticketCategory.findMany()
  }

  const student = await prisma.user.findFirst({ where: { role: "STUDENT" } })
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  const faculty = await prisma.user.findFirst({ where: { role: "FACULTY" } })

  const existingTickets = await prisma.ticket.count()
  if (existingTickets === 0 && categories.length > 0 && student && admin && faculty) {
    const itCat = categories.find((c) => c.name === "IT") || categories[0]
    const finCat = categories.find((c) => c.name === "Finance") || categories[1]
    const acadCat = categories.find((c) => c.name === "Academics") || categories[2]
    const sla = (cat: { slaHours: number }) => new Date(Date.now() + cat.slaHours * 3_600_000)

    await prisma.ticket.create({
      data: {
        title: "Wifi not working in hostel block C",
        description: "I am unable to connect to the campus wifi since morning. It shows authentication error.",
        status: "OPEN",
        priority: "HIGH",
        categoryId: itCat.id,
        creatorId: student.id,
        slaDeadline: sla(itCat),
      },
    })

    await prisma.ticket.create({
      data: {
        title: "Fee receipt not generated",
        description: "Paid the semester fee yesterday but receipt is not available on dashboard. Payment ID is PAY123456.",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        categoryId: finCat.id,
        creatorId: student.id,
        assigneeId: admin.id,
        slaDeadline: sla(finCat),
      },
    })

    await prisma.ticket.create({
      data: {
        title: "Request for extension on Assignment 2",
        description: "Due to medical reasons, I request an extension of 2 days for the upcoming assignment.",
        status: "WAITING_FOR_STUDENT",
        priority: "LOW",
        categoryId: acadCat.id,
        creatorId: student.id,
        assigneeId: faculty.id,
        slaDeadline: sla(acadCat),
      },
    })
  }

  revalidatePath("/dashboard/tickets")
}
