import type { PrismaClient } from "../../generated/prisma/client"
import { generateId } from "~/lib/id"

type WriteData = Record<string, unknown>
type RuntimeField = { name: string; kind: string; type: string; relationName?: string }
type RuntimeModel = { fields: RuntimeField[] }
const isRecord = (value: unknown): value is WriteData => typeof value === "object" && value !== null && !Array.isArray(value)

export function createIdWriteTransformer(client: PrismaClient) {
  // Prisma 7 exposes relation metadata on the runtime client rather than Prisma.dmmf
  const models = (client as unknown as { _runtimeDataModel: { models: Record<string, RuntimeModel> } })._runtimeDataModel.models

  function withIds(modelName: string, value: unknown, creating: boolean): unknown {
    if (Array.isArray(value)) return value.map((item) => withIds(modelName, item, creating))
    if (!isRecord(value)) return value
    const model = models[modelName]
    if (!model) return value
    const data = { ...value }
    const idField = model.fields.find((field) => field.name === "id" && field.kind === "scalar" && field.type === "String")
    if (creating && idField && data[idField.name] === undefined) data[idField.name] = generateId()

    for (const field of model.fields) {
      if (field.kind !== "object" || !field.relationName || !isRecord(data[field.name])) continue
      const relation = data[field.name] as WriteData
      data[field.name] = Object.fromEntries(Object.entries(relation).map(([operation, nested]) => [
        operation,
        nestedWrite(field.type, operation, nested),
      ]))
    }
    return data
  }

  function nestedWrite(model: string, operation: string, value: unknown): unknown {
    if (operation === "create") return withIds(model, value, true)
    if (!["createMany", "update", "updateMany", "upsert", "connectOrCreate"].includes(operation)) return value
    if (Array.isArray(value)) return value.map((item) => nestedWrite(model, operation, item))
    if (!isRecord(value)) return value
    if (operation === "upsert" || operation === "connectOrCreate") return {
      ...value,
      ...(value.create !== undefined ? { create: withIds(model, value.create, true) } : {}),
      ...(value.update !== undefined ? { update: withIds(model, value.update, false) } : {}),
    }
    if (operation === "update" && value.data === undefined) return withIds(model, value, false)
    return { ...value, data: withIds(model, value.data, operation === "createMany") }
  }

  return function withGeneratedIds(model: string, operation: string, args: WriteData): WriteData {
    if (["create", "createMany", "createManyAndReturn"].includes(operation)) return { ...args, data: withIds(model, args.data, true) }
    if (["update", "updateMany", "updateManyAndReturn"].includes(operation)) return { ...args, data: withIds(model, args.data, false) }
    if (operation === "upsert") return {
      ...args,
      create: withIds(model, args.create, true),
      update: withIds(model, args.update, false),
    }
    return args
  }
}
