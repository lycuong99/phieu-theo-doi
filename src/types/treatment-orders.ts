/** Name suggestions only; this is not a drug product, dose, or formulary entry. */
export type DrugName = { id: string; name: string };

export type OrderRelation =
  | { id: string; kind: 'mix'; name: string; amount: string; unit: string }
  | { id: string; kind: 'note'; text: string };

export type MedicationOrder = {
  id: string;
  kind: 'medication';
  sequence?: string;
  name: string;
  strength: string;
  dose: string;
  unit: string;
  repeat: string;
  route: string;
  timing: string;
  marker: string;
  rate: { value: string; unit: string };
  relations: OrderRelation[];
};
export type TextOrder = { id: string; kind: 'text'; sequence?: string; text: string };
export type TreatmentOrder = MedicationOrder | TextOrder;

/** Version belongs to the orders document, independently of the episode backup version. */
export type TreatmentOrdersV1 = { version: 1; items: TreatmentOrder[] };
/** Unconverted text is retained verbatim until a user edits it. */
export type TreatmentOrders = string | TreatmentOrdersV1;
