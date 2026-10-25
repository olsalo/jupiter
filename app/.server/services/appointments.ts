import { canRescheduleAppointment } from "~/lib/booking/appointment-status"
import { captureBookingPolicy, savedBookingPolicy } from "./booking-policy"
import { serializeAppointment } from "./serialization"
import { randomBytes } from "node:crypto"
import { TRPCError } from "@trpc/server"
import type { z } from "~/lib/validation/zod"
import type { createBookingInput, createAppointmentInput, createAppointmentWithCustomerInput } from "~/lib/schemas/appointments"
import type { PrismaClient, AppointmentStatus, AppointmentEventType } from "../../../generated/prisma/client"
import { Prisma } from "../../../generated/prisma/client"
import { getAvailableSlots } from "./availability"
import { resolveBookingPage } from "./booking-page"
import { cancelOutdatedNotifications, cancelReminders, queueNotification } from "./notifications"
import { notFound, schedulingLock, slotUnavailable, type Database } from "./scheduling"

type CreateInput = z.infer<typeof createAppointmentInput> | z.infer<typeof createBookingInput> | z.infer<typeof createAppointmentWithCustomerInput>
const detailInclude = { services: { include: { service: { select: { color: true, durationMinutes: true } } } }, answers: { include: { question: { select: { label: true, sortOrder: true } } } }, customer: true, staffMember: { select: { id: true, name: true } }, location: { select: { id: true, name: true } }, events: { orderBy: { createdAt: "asc" as const } } }
export async function getAppointment(db: Database, organizationId: string, id: string, scope: { staffMemberId?: string } = {}) {
  const appointment = await db.appointment.findFirst({ where: { id, organizationId, ...scope }, include: detailInclude })
  if (!appointment) notFound()
  return { ...serializeAppointment(appointment), answers: appointment.answers.map((answer) => ({ ...answer, question: { label: answer.label ?? answer.question.label, sortOrder: answer.sortOrder ?? answer.question.sortOrder } })), services: appointment.services.map((service) => ({ ...service, unitPrice: service.unitPrice.toString(), totalPrice: service.totalPrice.toString() })) }
}

export async function publicAppointment(db: Database, bookingCode: string) {
  const appointment = await db.appointment.findUnique({ where: { bookingCode }, select: {
    bookingCode: true, status: true, startsAt: true, endsAt: true, timezone: true, currency: true, totalAmount: true,
    services: { select: { name: true, durationMinutes: true } }, staffMember: { select: { name: true } }, location: { select: { name: true, addressLine1: true, city: true, bookingInstructions: true } },
  } })
  if (!appointment) notFound()
  return { ...appointment, totalAmount: appointment.totalAmount.toString() }
}

export async function deleteAppointment(db: PrismaClient, organizationId: string, id: string) {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    const result = await tx.appointment.deleteMany({ where: { id, organizationId } })
    if (!result.count) notFound()
    return { id }
  })
}

async function validateAnswers(tx: Database, organizationId: string, serviceId: string, answers: z.infer<typeof createBookingInput>["answers"]) {
  const questions = await tx.bookingQuestion.findMany({ where: { organizationId, isActive: true, OR: [{ serviceId: null }, { serviceId }] } })
  if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate booking answers" })
  for (const answer of answers) {
    const question = questions.find((question) => question.id === answer.questionId)
    if (!question) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown booking question" })
    const value = answer.value
    const options = Array.isArray(question.options) ? question.options : []
    let valid = false
    switch (question.type) {
      case "BOOLEAN": valid = typeof value === "boolean"
        break
      case "NUMBER": valid = typeof value === "number" && Number.isFinite(value)
        break
      case "SINGLE_SELECT": valid = typeof value === "string" && options.includes(value)
        break
      case "MULTI_SELECT": valid = Array.isArray(value) && value.every((entry) => options.includes(entry))
        break
      case "EMAIL": valid = typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        break
      case "PHONE": valid = typeof value === "string" && /^\+?[\d\s().-]{5,40}$/.test(value)
        break
      case "DATE": valid = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
        break
      case "DATETIME": valid = typeof value === "string" && Number.isFinite(Date.parse(value))
        break
      default: valid = typeof value === "string"
    }
    if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: `Check your answer to ${question.label}` })
  }
  for (const question of questions.filter((question) => question.required)) {
    const answer = answers.find((answer) => answer.questionId === question.id)
    if (!answer || answer.value === "" || (Array.isArray(answer.value) && !answer.value.length)) throw new TRPCError({ code: "BAD_REQUEST", message: `Answer ${question.label}` })
  }
  return questions
}

export async function createAppointment(db: PrismaClient, organizationId: string, input: CreateInput, actorUserId?: string) {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId } })
    const isPublic = "organizationSlug" in input
    const bookingPage = isPublic ? await resolveBookingPage(tx, input) : null
    if (bookingPage && bookingPage.organization.id !== organizationId) notFound()
    const service = await tx.service.findFirst({ where: { id: input.serviceId, organizationId, deletedAt: null, isActive: true } })
    if (!service) notFound()
    const durationMinutes = !isPublic && "durationMinutes" in input ? input.durationMinutes : undefined
    const locationId = bookingPage?.locationId ?? input.locationId
    const slots = await getAvailableSlots(tx, organizationId, { serviceId: input.serviceId, staffMemberId: input.staffMemberId, locationId, from: input.startsAt, to: new Date(+input.startsAt + 1) }, { allowPast: !isPublic, allowBreakOverlapStart: !isPublic && "allowBreakOverlap" in input && input.allowBreakOverlap ? +input.startsAt : undefined, allowedStaffIds: bookingPage?.allowedStaffIds, durationMinutes })
    const slot = slots.days.flatMap((day) => day.slots).find((slot) => slot.startsAt === input.startsAt.toISOString())
    if (!slot) slotUnavailable()
    let customer
    let questions: Awaited<ReturnType<typeof validateAnswers>> = []
    if (isPublic) {
      if ((settings?.requireCustomerEmail !== false && !input.customer.email) || (settings?.requireCustomerPhone && !input.customer.phone)) throw new TRPCError({ code: "BAD_REQUEST", message: "Add the required contact details" })
      questions = await validateAnswers(tx, organizationId, service.id, input.answers)
    }
    if ("customer" in input) {
      // Serialized with booking writes; never copy unverified submitted details over
      // an existing customer's private record
      customer = input.customer.email ? await tx.customer.findFirst({ where: { organizationId, email: { equals: input.customer.email, mode: "insensitive" } }, orderBy: { createdAt: "asc" } }) : null
      customer ??= input.customer.phone ? await tx.customer.findFirst({ where: { organizationId, phone: input.customer.phone }, orderBy: { createdAt: "asc" } }) : null
      customer ??= await tx.customer.create({ data: { organizationId, ...input.customer } })
    } else {
      customer = await tx.customer.findFirst({ where: { id: input.customerId, organizationId } })
      if (!customer) notFound()
    }
    const confirmed = settings?.autoConfirmAppointments !== false && !service.requiresConfirmation
    const appointment = await tx.appointment.create({ data: {
      organizationId, customerId: customer.id, staffMemberId: slot.staffMemberId, locationId: slot.locationId,
      ...captureBookingPolicy(settings, service),
      bookingCode: randomBytes(24).toString("base64url"), startsAt: input.startsAt, endsAt: new Date(slot.endsAt), timezone: settings?.bookingTimezone ?? settings?.timezone ?? "Europe/Helsinki",
      status: confirmed ? "CONFIRMED" : "PENDING", confirmedAt: confirmed ? new Date() : null, source: isPublic ? "PUBLIC_BOOKING" : "ADMIN",
      customerNotes: isPublic ? input.notes : undefined, internalNotes: !isPublic ? input.notes : undefined,
      currency: service.currency, subtotalAmount: service.price ?? "0", totalAmount: service.price ?? "0",
      services: { create: { serviceId: service.id, staffMemberId: slot.staffMemberId, name: service.name, durationMinutes: durationMinutes ?? service.durationMinutes, unitPrice: service.price ?? "0", totalPrice: service.price ?? "0", bufferBeforeMinutes: service.bufferBeforeMinutes, bufferAfterMinutes: service.bufferAfterMinutes } },
      events: { create: { type: "CREATED", actorUserId } },
      ...(isPublic ? { answers: { create: input.answers.map((answer) => {
        const question = questions.find((question) => question.id === answer.questionId)!
        return { ...answer, label: question.label, type: question.type, sortOrder: question.sortOrder, options: question.options ?? Prisma.DbNull }
      }) } } : {}),
    } })
    await queueNotification(tx, organizationId, appointment.id, "BOOKING_CONFIRMATION")
    await queueNotification(tx, organizationId, appointment.id, "REMINDER")
    await tx.auditLog.create({ data: { organizationId, actorUserId, action: "appointment.created", entityType: "appointment", entityId: appointment.id } })
    return serializeAppointment(appointment)
  }, { timeout: 15000 })
}

export const transitions: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"],
  CHECKED_IN: ["IN_PROGRESS", "COMPLETED", "CANCELLED"], IN_PROGRESS: ["COMPLETED"],
}
export function assertTransition(current: AppointmentStatus, next: AppointmentStatus) {
  if (!transitions[current]?.includes(next)) throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment cannot be changed that way" })
}

export async function changeAppointment(db: PrismaClient, organizationId: string, input: { id: string; status?: AppointmentStatus; startsAt?: Date; durationMinutes?: number; allowBreakOverlap?: boolean; serviceId?: string; staffMemberId?: string; reason?: string; customerId?: string; customerNotes?: string | null; internalNotes?: string | null }, options: { actorUserId?: string; public?: boolean; staffMemberId?: string } = {}) {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    const appointment = await getAppointment(tx, organizationId, input.id, options.staffMemberId ? { staffMemberId: options.staffMemberId } : {})
    if (appointment.status === "PENDING" && appointment.expiresAt && appointment.expiresAt <= new Date() && input.status !== "CANCELLED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This booking hold has expired" })
    }
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId } })
    const snapshot = appointment.services[0]
    const service = snapshot ? await tx.service.findFirst({ where: { id: snapshot.serviceId, organizationId } }) : null
    if (options.public) {
      if (input.durationMinutes !== undefined || input.staffMemberId !== undefined || input.serviceId !== undefined) throw new TRPCError({ code: "FORBIDDEN" })
      const cancellation = input.status === "CANCELLED"
      if (!cancellation && !input.startsAt) throw new TRPCError({ code: "FORBIDDEN" })
      const policy = savedBookingPolicy(appointment, settings, service)
      const allowed = cancellation ? policy.allowCustomerCancellation : policy.allowCustomerRescheduling
      const notice = cancellation ? policy.cancellationNoticeMinutes : policy.rescheduleNoticeMinutes
      if (allowed === false || +appointment.startsAt - Date.now() < notice * 60000) throw new TRPCError({ code: "BAD_REQUEST", message: "Contact the business to change this appointment" })
    }
    let type: AppointmentEventType = "NOTE_ADDED"
    const data: import("../../../generated/prisma/client").Prisma.AppointmentUpdateInput = {}
    const targetStart = input.startsAt ?? appointment.startsAt
    const targetMemberId = input.staffMemberId ?? appointment.staffMemberId
    const replacingService = Boolean(input.serviceId && input.serviceId !== snapshot?.serviceId)
    if (input.startsAt || input.durationMinutes !== undefined || input.staffMemberId !== undefined || replacingService) {
      if ((input.durationMinutes !== undefined || input.staffMemberId !== undefined || replacingService) && appointment.services.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "This booking length cannot be changed" })
      if (!(options.public ? ["PENDING", "CONFIRMED"].includes(appointment.status) : canRescheduleAppointment(appointment.status)) || !snapshot || !targetMemberId) throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment cannot be rescheduled" })
      const replacement = replacingService ? await tx.service.findFirst({ where: { id: input.serviceId, organizationId, deletedAt: null, isActive: true } }) : null
      if (replacingService && !replacement) notFound()
      const durationMinutes = input.durationMinutes ?? replacement?.durationMinutes ?? (input.staffMemberId !== undefined ? snapshot.durationMinutes : undefined)
      const available = await getAvailableSlots(tx, organizationId, { serviceId: replacement?.id ?? snapshot.serviceId, staffMemberId: targetMemberId, locationId: appointment.locationId ?? undefined, from: targetStart, to: new Date(+targetStart + 1) }, { allowPast: !options.public, allowBreakOverlapStart: !options.public && input.allowBreakOverlap ? +targetStart : undefined, excludeAppointmentId: appointment.id, snapshot: replacement ?? snapshot, replacingService, durationMinutes, useOrganizationDefaults: false, purpose: "reschedule", bookingPolicy: savedBookingPolicy(appointment, settings, service) })
      const slot = available.days.flatMap((day) => day.slots).find((slot) => slot.startsAt === targetStart.toISOString() && slot.locationId === appointment.locationId)
      if (!slot) slotUnavailable()
      data.startsAt = targetStart
      data.endsAt = new Date(slot.endsAt)
      if (input.staffMemberId !== undefined) data.staffMember = { connect: { id: slot.staffMemberId } }
      if (input.durationMinutes !== undefined || input.staffMemberId !== undefined || replacement) data.services = { update: { where: { id: snapshot.id }, data: {
        durationMinutes: durationMinutes ?? snapshot.durationMinutes, staffMemberId: slot.staffMemberId,
        ...(replacement ? { serviceId: replacement.id, name: replacement.name, unitPrice: replacement.price ?? "0", totalPrice: new Prisma.Decimal(replacement.price ?? 0).mul(snapshot.quantity), bufferBeforeMinutes: replacement.bufferBeforeMinutes, bufferAfterMinutes: replacement.bufferAfterMinutes } : {}),
      } } }
      if (replacement) {
        if (replacement.currency !== appointment.currency && [appointment.paidAmount, appointment.discountAmount, appointment.taxAmount].some((amount) => new Prisma.Decimal(amount).isPositive())) throw new TRPCError({ code: "BAD_REQUEST", message: "This booking currency cannot be changed" })
        const subtotal = new Prisma.Decimal(replacement.price ?? 0).mul(snapshot.quantity)
        data.currency = replacement.currency
        data.subtotalAmount = subtotal
        data.totalAmount = Prisma.Decimal.max(0, subtotal.minus(appointment.discountAmount).plus(appointment.taxAmount))
      }
      type = "RESCHEDULED"
    } else if (input.status) {
      assertTransition(appointment.status, input.status)
      data.status = input.status
      const now = new Date()
      const mapping = { CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED", CHECKED_IN: "CHECKED_IN", IN_PROGRESS: "STARTED", COMPLETED: "COMPLETED", NO_SHOW: "NO_SHOW" } as const
      if (input.status === "PENDING") throw new TRPCError({ code: "BAD_REQUEST" })
      type = mapping[input.status]
      if (input.status === "CONFIRMED") { data.confirmedAt = now
        data.expiresAt = null }
      if (input.status === "CANCELLED") { data.cancelledAt = now
        data.cancellationReason = input.reason }
      if (input.status === "CHECKED_IN") data.checkedInAt = now
      if (input.status === "IN_PROGRESS") data.startedAt = now
      if (input.status === "COMPLETED") data.completedAt = now
    }
    if (input.customerId !== undefined) {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, organizationId } })
      if (!customer) notFound()
      data.customer = { connect: { id: customer.id } }
    }
    data.customerNotes = input.customerNotes
    data.internalNotes = input.internalNotes
    await tx.appointment.update({ where: { id: appointment.id, organizationId }, data })
    await tx.appointmentEvent.create({ data: { organizationId, appointmentId: appointment.id, type, actorUserId: options.actorUserId, metadata: type === "RESCHEDULED" ? { previousStartsAt: appointment.startsAt.toISOString(), startsAt: targetStart.toISOString(), previousStaffMemberId: appointment.staffMemberId, staffMemberId: targetMemberId, previousServiceId: snapshot?.serviceId, serviceId: input.serviceId ?? snapshot?.serviceId, previousEndsAt: appointment.endsAt.toISOString(), endsAt: (data.endsAt as Date).toISOString() } : undefined } })
    if (["CANCELLED", "RESCHEDULED"].includes(type)) await cancelOutdatedNotifications(tx, organizationId, appointment.id)
    if (["COMPLETED", "NO_SHOW"].includes(type)) await cancelReminders(tx, organizationId, appointment.id)
    if (type === "CANCELLED") await queueNotification(tx, organizationId, appointment.id, "CANCELLATION")
    if (type === "RESCHEDULED") { await queueNotification(tx, organizationId, appointment.id, "RESCHEDULE")
      await queueNotification(tx, organizationId, appointment.id, "REMINDER") }
    await tx.auditLog.create({ data: { organizationId, actorUserId: options.actorUserId, action: `appointment.${type.toLowerCase()}`, entityType: "appointment", entityId: appointment.id } })
    return getAppointment(tx, organizationId, appointment.id)
  }, { timeout: 15000 })
}
