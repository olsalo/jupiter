import { createHash } from "node:crypto"
import { Temporal } from "@js-temporal/polyfill"
import { z } from "zod"
import type { Prisma, PrismaClient } from "../../generated/prisma/client.ts"
import { generateId } from "../../app/lib/database/id.ts"
import { businessHolidayWindows, defaultBusinessHolidays } from "../../app/lib/business/business-holidays.ts"

export const barberSeedOptions = z.object({
  ownerName: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email()),
})

const timezone = "Europe/Helsinki"
const seedKind = "jupiter-barber-v1"
const services = [
  { name: "Classic Haircut", slug: "classic-haircut", durationMinutes: 30, price: 32, category: 0, description: "A tailored cut with a wash and finish", color: "#3b82f6" },
  { name: "Skin Fade", slug: "skin-fade", durationMinutes: 45, price: 38, category: 0, description: "A precise fade blended down to the skin", color: "#6366f1" },
  { name: "Clipper Cut", slug: "clipper-cut", durationMinutes: 15, price: 22, category: 0, description: "An even all-over clipper cut with clean edges", color: "#0ea5e9" },
  { name: "Kids Haircut", slug: "kids-haircut", durationMinutes: 30, price: 25, category: 0, description: "A relaxed haircut for children aged 6–12", color: "#14b8a6" },
  { name: "Beard Trim", slug: "beard-trim", durationMinutes: 15, price: 18, category: 1, description: "Shape, tidy and finish with beard oil", color: "#f59e0b" },
  { name: "Hot Towel Shave", slug: "hot-towel-shave", durationMinutes: 30, price: 30, category: 1, description: "A traditional wet shave with a warm towel finish", color: "#f97316" },
  { name: "Haircut & Beard Trim", slug: "haircut-beard-trim", durationMinutes: 45, price: 46, category: 2, description: "Our classic haircut paired with a beard shape-up", color: "#8b5cf6" },
  { name: "The Full Groom", slug: "full-groom", durationMinutes: 60, price: 65, category: 2, description: "A haircut, beard detail and hot towel treatment", color: "#ec4899" },
]

const customerNames = [
  "James Wilson", "Oliver Brown", "William Taylor", "Henry Davies", "George Evans", "Jack Thomas",
  "Charlie Roberts", "Thomas Johnson", "Harry Walker", "Oscar Wright", "Noah Robinson", "Leo Thompson",
  "Arthur White", "Alfie Hughes", "Freddie Edwards", "Archie Green", "Theo Hall", "Ethan Lewis",
  "Lucas Harris", "Mason Clarke", "Logan Patel", "Jacob Turner", "Daniel Carter", "Benjamin Scott",
  "Samuel King", "Alexander Baker", "Maxwell Hill", "Joseph Adams", "Edward Nelson", "Louis Mitchell",
  "Isaac Campbell", "Adam Parker", "Nathan Reed", "Dylan Brooks", "Ryan Morgan", "Toby Collins",
]

function localTime(date: Temporal.PlainDate, hour: number, minute = 0) {
  return new Date(date.toZonedDateTime({ timeZone: timezone, plainTime: { hour, minute } }).epochMilliseconds)
}

// Each barber has a different working week and breaks suited to the shift length.
const staffSchedules = [
  { days: [2, 3, 4, 5, 6], start: 540, end: 1080, breaks: [[750, 795], [930, 945]], saturday: { start: 540, end: 900, breaks: [[720, 750]] } },
  { days: [1, 2, 4, 5, 6], start: 600, end: 1080, breaks: [[780, 810], [960, 980]], saturday: { start: 540, end: 900, breaks: [[735, 755]] } },
  { days: [2, 3, 4, 5, 6], start: 540, end: 960, breaks: [[720, 750]], saturday: { start: 540, end: 780, breaks: [] } },
  { days: [1, 2, 3, 4, 5], start: 540, end: 1080, breaks: [[645, 660], [735, 765], [915, 930]], saturday: { start: 540, end: 900, breaks: [] } },
  { days: [1, 2, 3, 4, 5, 6], start: 720, end: 1080, breaks: [[870, 890]], saturday: { start: 600, end: 900, breaks: [[750, 760]] } },
]

/** Creates a separate, atomic demo business per owner. Existing demos and accounts are preserved. */
export async function seedBarberShop(db: PrismaClient, input: z.input<typeof barberSeedOptions>, now = new Date()) {
  const options = barberSeedOptions.parse(input)
  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timezone).toPlainDate()
  const businessHolidays = { version: 2, holidays: defaultBusinessHolidays(today.year) }
  const holidayWindows = businessHolidayWindows(businessHolidays, localTime(today.subtract({ days: 28 }), 0), localTime(today.add({ days: 15 }), 0), timezone)
  const slug = `barber-demo-${createHash("sha256").update(options.ownerEmail).digest("hex").slice(0, 16)}`

  return db.$transaction(async (tx) => {
    // Serialize repeat/concurrent runs before checking for an existing demo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${slug}, 0))`
    const existing = await tx.organization.findUnique({ where: { slug }, include: { members: { where: { role: "owner" }, include: { user: true } } } })
    if (existing) {
      if (existing.metadata !== seedKind || !existing.members.some((member) => member.user.email.toLowerCase() === options.ownerEmail)) {
        throw new Error("The demo slug belongs to another business")
      }
      return { organizationId: existing.id, slug, created: false }
    }

    const owner = await tx.user.upsert({
      where: { email: options.ownerEmail },
      update: {},
      create: { id: generateId(), name: options.ownerName, email: options.ownerEmail, locale: "en" },
    })
    const organizationId = generateId()
    await tx.organization.create({ data: { id: organizationId, name: "Northside Barbers", slug, metadata: seedKind, createdAt: now } })
    const locationId = generateId()
    await tx.location.create({ data: {
      id: locationId, organizationId, name: "City Centre", slug: "city-centre",
      addressLine1: "Fredrikinkatu 24", city: "Helsinki", postalCode: "00120", country: "FI", timezone,
      email: `hello@${slug}.example.invalid`, bookingInstructions: "Please arrive five minutes before your appointment",
    } })
    const bookingPageId = generateId()
    await tx.bookingPage.create({ data: {
      id: bookingPageId, organizationId, slug: "book", name: "Book a barber", title: "Look sharp, feel good",
      description: "Your usual trim or a whole new look. Pull up a chair, we'll take care of the rest",
      defaultLocationId: locationId, allowLocationSelection: false, accentColor: "#3b82f6",
      successMessage: "Thanks for booking with Northside Barbers. We'll see you in the chair soon!",
    } })
    await tx.organizationSettings.create({ data: {
      id: generateId(), organizationId, timezone, countryCode: "FI", currency: "EUR", onboardingStep: null,
      businessHolidays, defaultLocationId: locationId, defaultBookingPageId: bookingPageId,
      defaultStartHour: 9, defaultEndHour: 18, defaultCalendarView: "week", showWeekends: true,
      minBookingNoticeMinutes: 60, maxBookingAdvanceDays: 60, cancellationNoticeMinutes: 1440, rescheduleNoticeMinutes: 1440,
      // Demo appointments never enqueue messages, including when the jobs runner is active.
      sendBookingConfirmations: false, sendCancellationEmails: false, sendRescheduleEmails: false, enableAppointmentReminders: false,
    } })

    const people = [
      { name: options.ownerName, email: options.ownerEmail, userId: owner.id, role: "owner", bio: "Shop owner, looking after the team and the day-to-day running of the business" },
      { name: "Alex Morgan", email: `alex@${slug}.example.invalid`, role: "admin", bio: "Senior barber with a passion for sharp fades and modern styles" },
      { name: "Daniel Brooks", email: `daniel@${slug}.example.invalid`, role: "member", bio: "Beard specialist who loves a clean finish and a good conversation" },
      { name: "Jamie Parker", email: `jamie@${slug}.example.invalid`, role: "member", bio: "Friendly barber offering relaxed cuts for adults and children" },
      { name: "Oliver Reed", email: `oliver@${slug}.example.invalid`, role: "member", bio: "Experienced barber specialising in classic scissor cuts and traditional shaving" },
      { name: "Ethan Clarke", email: `ethan@${slug}.example.invalid`, role: "member", bio: "Afternoon barber with an eye for textured cuts and precise beard lines" },
    ]
    const staffIds: string[] = []
    for (const person of people) {
      const userId = person.userId ?? generateId()
      if (!person.userId) await tx.user.create({ data: { id: userId, name: person.name, email: person.email, locale: "en" } })
      const memberId = generateId()
      await tx.member.create({ data: { id: memberId, organizationId, userId, role: person.role, createdAt: now } })
      const id = generateId()
      const acceptsAppointments = person.role !== "owner"
      await tx.staffMember.create({ data: { id, organizationId, memberId, name: person.name, email: person.email, bio: person.bio, timezone, acceptsAppointments } })
      await tx.staffLocation.create({ data: { id: generateId(), staffMemberId: id, locationId } })
      if (acceptsAppointments) staffIds.push(id)
    }

    const categoryIds: string[] = []
    for (const [sortOrder, name] of ["Haircuts", "Beard & Shave", "Packages"].entries()) {
      const id = generateId()
      await tx.serviceCategory.create({ data: { id, organizationId, name, sortOrder } })
      categoryIds.push(id)
    }
    const serviceIds: string[] = []
    for (const [sortOrder, { category, ...service }] of services.entries()) {
      const id = generateId()
      await tx.service.create({ data: { id, organizationId, categoryId: categoryIds[category], ...service, sortOrder, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 } })
      await tx.serviceLocation.create({ data: { id: generateId(), serviceId: id, locationId } })
      serviceIds.push(id)
    }
    await tx.staffService.createMany({ data: staffIds.flatMap((staffMemberId) => serviceIds.map((serviceId) => ({ id: generateId(), staffMemberId, serviceId }))) })
    await tx.bookingPageService.createMany({ data: serviceIds.map((serviceId, sortOrder) => ({ id: generateId(), bookingPageId, serviceId, sortOrder })) })
    await tx.bookingPageStaff.createMany({ data: staffIds.map((staffMemberId, sortOrder) => ({ id: generateId(), bookingPageId, staffMemberId, sortOrder })) })

    const rules: Prisma.AvailabilityRuleCreateManyInput[] = []
    for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
      const hours = { organizationId, dayOfWeek, startMinute: 540, endMinute: dayOfWeek === 6 ? 900 : dayOfWeek === 1 ? 1020 : 1080, timezone }
      rules.push({ id: generateId(), ...hours })
      for (const [index, staffMemberId] of staffIds.entries()) {
        const schedule = staffSchedules[index]
        if (!schedule.days.includes(dayOfWeek)) continue
        const shift = dayOfWeek === 6 ? schedule.saturday : schedule
        const startMinute = Math.max(hours.startMinute, shift.start)
        const endMinute = Math.min(hours.endMinute, shift.end)
        rules.push({ id: generateId(), ...hours, staffMemberId, startMinute, endMinute })
        for (const [start, end] of shift.breaks) {
          if (start >= startMinute && end <= endMinute) rules.push({ id: generateId(), ...hours, staffMemberId, startMinute: start, endMinute: end, isBreak: true })
        }
      }
    }
    await tx.availabilityRule.createMany({ data: rules })

    const names = customerNames.flatMap((name) => [name, ...["Anderson", "Cooper", "Foster", "Bennett", "Phillips", "Russell", "Ward", "Hayes", "Griffin"].map((lastName) => `${name.split(" ")[0]} ${lastName}`)])
    const customers = names.map((name, index) => {
      const [firstName, lastName] = name.split(" ")
      return { id: generateId(), organizationId, firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.invalid`, locale: "en", timezone, marketingConsent: index % 3 === 0 }
    })
    await tx.customer.createMany({ data: customers })
    const tagId = generateId()
    await tx.customerTag.create({ data: { id: tagId, organizationId, name: "Regular", color: "#3b82f6" } })
    await tx.customerTagAssignment.createMany({ data: customers.slice(0, 12).map((customer) => ({ id: generateId(), tagId, customerId: customer.id })) })
    await tx.customerNote.createMany({ data: customers.slice(0, 12).map((customer, index) => ({
      id: generateId(), organizationId, customerId: customer.id, authorUserId: owner.id,
      body: ["Prefers a number 2 on the sides with a natural neckline", "Usually books every four weeks — likes an early appointment", "Sensitive skin — use fragrance-free products"][index % 3],
    })) })

    const appointments: Prisma.AppointmentCreateManyInput[] = []
    const snapshots: Prisma.AppointmentServiceCreateManyInput[] = []
    const attendees: Prisma.AppointmentAttendeeCreateManyInput[] = []
    const payments: Prisma.PaymentCreateManyInput[] = []
    const events: Prisma.AppointmentEventCreateManyInput[] = []
    const customerLastVisit = new Map<string, number>()
    for (let day = -28; day <= 14; day++) {
      const date = today.add({ days: day })
      if (date.dayOfWeek === 7) continue
      for (const [staffIndex, staffMemberId] of staffIds.entries()) {
        const businessHours = rules.find((rule) => !rule.staffMemberId && rule.dayOfWeek === date.dayOfWeek)!
        const shift = rules.find((rule) => rule.staffMemberId === staffMemberId && rule.dayOfWeek === date.dayOfWeek && !rule.isBreak)
        if (!shift) continue
        const breaks = rules.filter((rule) => rule.staffMemberId === staffMemberId && rule.dayOfWeek === date.dayOfWeek && rule.isBreak)
        let occupiedUntil = 0
        let bookedSegment = -1
        const dailySegments = date.dayOfWeek === 6 ? 3 : 4
        for (let startMinute = shift.startMinute; startMinute < shift.endMinute; startMinute += 15) {
          // Spread visits throughout the shift instead of filling only the morning.
          const segment = Math.floor((startMinute - shift.startMinute) * dailySegments / (shift.endMinute - shift.startMinute))
          if (segment === bookedSegment) continue
          const index = appointments.length
          // Stagger empty slots, leaving room to try new bookings.
          if ((day + staffIndex + startMinute / 15) % 5 === 0) continue
          const serviceIndex = (index + staffIndex + startMinute / 15) % services.length
          const service = services[serviceIndex]
          const occupiedEndMinute = startMinute + service.durationMinutes
          if (startMinute < occupiedUntil || startMinute < businessHours.startMinute || occupiedEndMinute > Math.min(shift.endMinute, businessHours.endMinute)) continue
          if (breaks.some((pause) => startMinute < pause.endMinute && occupiedEndMinute > pause.startMinute)) continue
          const startsAt = localTime(date, Math.floor(startMinute / 60), startMinute % 60)
          const endsAt = new Date(+startsAt + service.durationMinutes * 60_000)
          const occupiedEnd = +endsAt
          if (holidayWindows.some((window) => !window.isOpen && +startsAt < window.end && occupiedEnd > window.start)) continue
          // Regulars return after at least three weeks, rather than appearing every few days.
          const customer = Array.from({ length: customers.length }, (_, offset) => customers[(index * 7 + staffIndex + offset) % customers.length])
            .find((candidate) => day - (customerLastVisit.get(candidate.id) ?? -Infinity) >= 21)
          if (!customer) continue
          const past = endsAt <= now
          const cancelled = index % 23 === 0
          const status = cancelled ? "CANCELLED" : past ? (index % 29 === 0 ? "NO_SHOW" : "COMPLETED") : startsAt <= now ? "IN_PROGRESS" : index % 13 === 0 ? "PENDING" : "CONFIRMED"
          const paid = status === "COMPLETED"
          occupiedUntil = occupiedEndMinute
          bookedSegment = segment
          if (!cancelled) customerLastVisit.set(customer.id, day)
          const id = generateId()
          const createdAt = new Date(Math.min(+now, +startsAt - (2 + index % 10) * 86_400_000))
          const cancelledAt = cancelled ? new Date(Math.min(+now, +startsAt - 86_400_000)) : null
          appointments.push({
            id, organizationId, bookingCode: `DEMO-${generateId()}`, customerId: customer.id, staffMemberId, locationId,
            status, source: index % 3 === 0 ? "ADMIN" : "PUBLIC_BOOKING", startsAt, endsAt, timezone,
            createdAt, confirmedAt: status === "PENDING" ? null : createdAt,
            completedAt: paid ? endsAt : null, startedAt: paid || status === "IN_PROGRESS" ? startsAt : null,
            cancelledAt,
            cancellationReason: cancelled ? "Customer's plans changed" : null,
            subtotalAmount: service.price, totalAmount: service.price, paidAmount: paid ? service.price : 0, currency: "EUR",
            cancellationNoticeMinutes: 1440, rescheduleNoticeMinutes: 1440, minBookingNoticeMinutes: 60, maxBookingAdvanceDays: 60,
            allowCustomerCancellation: true, allowCustomerRescheduling: true,
            customerNotes: index % 11 === 0 ? "Please keep a little length on top" : null,
            metadata: { seed: seedKind },
          })
          snapshots.push({ id: generateId(), appointmentId: id, serviceId: serviceIds[serviceIndex], staffMemberId, name: service.name, durationMinutes: service.durationMinutes, unitPrice: service.price, totalPrice: service.price, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 })
          attendees.push({ id: generateId(), appointmentId: id, customerId: customer.id, name: `${customer.firstName} ${customer.lastName}`, email: customer.email, status: paid ? "ATTENDED" : status === "NO_SHOW" ? "NO_SHOW" : cancelled ? "CANCELLED" : status === "PENDING" ? "BOOKED" : "CONFIRMED" })
          events.push({ id: generateId(), organizationId, appointmentId: id, type: "CREATED", message: "Appointment booked", createdAt })
          if (paid) {
            payments.push({ id: generateId(), organizationId, appointmentId: id, customerId: customer.id, provider: "manual", status: "PAID", amount: service.price, currency: "EUR", paidAt: endsAt, description: `${service.name} — ${index % 4 === 0 ? "cash" : "card"}` })
            events.push({ id: generateId(), organizationId, appointmentId: id, type: "COMPLETED", createdAt: endsAt })
          } else if (cancelled || status === "NO_SHOW") {
            events.push({ id: generateId(), organizationId, appointmentId: id, type: cancelled ? "CANCELLED" : "NO_SHOW", createdAt: cancelledAt ?? endsAt })
          }
        }
      }
    }
    await tx.appointment.createMany({ data: appointments })
    await tx.appointmentService.createMany({ data: snapshots })
    await tx.appointmentAttendee.createMany({ data: attendees })
    await tx.payment.createMany({ data: payments })
    await tx.appointmentEvent.createMany({ data: events })
    return { organizationId, slug, created: true }
  }, { timeout: 120_000 })
}
