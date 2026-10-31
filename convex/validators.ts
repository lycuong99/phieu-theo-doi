import { v } from 'convex/values';

export const patient = v.object({
  name: v.string(), birth: v.string(), gender: v.string(), code: v.string(), admission: v.string(),
  department: v.string(), room: v.string(), bed: v.string(), diagnosis: v.string(), differential: v.string(),
});
const orderRelation = v.union(
  v.object({ id: v.string(), kind: v.literal('mix'), name: v.string(), amount: v.string(), unit: v.string() }),
  v.object({ id: v.string(), kind: v.literal('note'), text: v.string() }),
);
export const structuredOrders = v.object({
  version: v.literal(1),
  items: v.array(v.union(
    v.object({ id: v.string(), kind: v.literal('text'), sequence: v.optional(v.string()), text: v.string() }),
    v.object({
      id: v.string(), kind: v.literal('medication'), sequence: v.optional(v.string()), name: v.string(), strength: v.string(),
      dose: v.string(), unit: v.string(), repeat: v.string(), route: v.string(), timing: v.string(), marker: v.string(),
      rate: v.object({ value: v.string(), unit: v.string() }), relations: v.array(orderRelation),
    }),
  )),
});
export const treatmentOrders = v.union(v.string(), structuredOrders);
export const row = v.object({
  id: v.string(), time: v.string(), progress: v.string(), orders: treatmentOrders,
  session: v.optional(v.union(v.literal('morning'), v.literal('afternoon'))),
});
// Additive schema: old records remain readable until their first v2 save.
const infusionRow = v.object({ id: v.string(), date: v.string(), fluid: v.string(), quantity: v.string(), batch: v.string(), rate: v.string(), start: v.string(), end: v.string(), doctor: v.string(), nurse: v.string() });
const goal = v.object({ id: v.string(), text: v.string(), achieved: v.boolean() });
export const forms = v.object({
  treatment: v.object({ rows: v.array(row) }),
  infusion: v.object({ rows: v.array(infusionRow) }),
  care: v.object({ allergyStatus: v.union(v.literal(''), v.literal('unknown'), v.literal('known')), allergy: v.string(),
    observations: v.array(v.object({ id: v.string(), time: v.string(), values: v.record(v.string(), v.string()) })),
    diagnoses: v.array(v.object({ id: v.string(), text: v.string(), goals: v.array(goal) })) }),
});
export const patientReview = v.object({ base: patient, byDay: v.record(v.string(), patient), resolved: v.boolean() });
export const recordFields = {
  patient, forms: v.optional(forms), patientReview: v.optional(patientReview), rows: v.optional(v.array(row)), dayPatients: v.optional(v.record(v.string(), patient)),
  status: v.optional(v.union(v.literal('active'), v.literal('completed'))),
  startedOn: v.optional(v.string()), endedOn: v.optional(v.union(v.string(), v.null())),
};
export const record = v.object({ id: v.string(), ...recordFields });
export const recordPatch = v.object({
  patient: v.optional(patient), forms: v.optional(forms), patientReview: v.optional(patientReview), rows: v.optional(v.array(row)), dayPatients: recordFields.dayPatients,
  status: recordFields.status, startedOn: recordFields.startedOn, endedOn: recordFields.endedOn,
});
export const templateFields = {
  kind: v.union(v.literal('progress'), v.literal('orders')), text: v.string(), group: v.string(), name: v.optional(v.string()), orders: v.optional(structuredOrders),
};
export const template = v.object({ id: v.string(), ...templateFields });
export const templatePatch = v.object({
  name: v.optional(v.string()), orders: v.optional(structuredOrders), kind: v.optional(templateFields.kind), text: v.optional(v.string()), group: v.optional(v.string()),
});
