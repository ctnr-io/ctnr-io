
// Qonto API TypeScript SDK - Auto-generated from Postman Collection

// Base types
export interface QontoError {
  code: string;
  detail: string;
  source?: { parameter?: string; pointer?: string; };
}

export interface QontoErrorResponse {
  errors: QontoError[];
}

// Generated endpoint types
export interface ShowExternalTransferPathParams {
  id: string;
}

export type ShowExternalTransferResponse = Partial<{
  external_transfer: Partial<{
  id: string;
  slug: string;
  debit_iban: string;
  debit_amount: string;
  debit_amount_cents: string;
  debit_currency: string;
  initiator_id: string;
  beneficiary_id: string;
  credit_amount: string;
  credit_amount_cents: string;
  credit_currency: string;
  reference: string;
  status: string;
  created_at: string;
  scheduled_date: string;
  rate_applied: string;
  payment_purpose: string;
  note: string;
  declined_reason: string;
  completed_at: string;
  processed_at: string;
  transaction_id: string;
}>;
}>;

export type ListExternalTransfersResponse = Partial<{
  external_transfers: Partial<{
  id: string;
  slug: string;
  debit_iban: string;
  debit_amount: string;
  debit_amount_cents: string;
  debit_currency: string;
  initiator_id: string;
  beneficiary_id: string;
  credit_amount: string;
  credit_amount_cents: string;
  credit_currency: string;
  reference: string;
  status: string;
  created_at: string;
  scheduled_date: string;
  rate_applied: string;
  payment_purpose: string;
  note: string;
  declined_reason: string;
  completed_at: string;
  processed_at: string;
  transaction_id: string;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateExternalTransferWithTrustedBeneficiaryRequest = Partial<{
  external_transfer: Partial<{
  beneficiary_id: string;
  debit_iban: string;
  reference: string;
  amount: string;
  currency: string;
  note: string;
  scheduled_date: string;
  attachment_ids: string[];
}>;
}>;

export type CreateExternalTransferWithTrustedBeneficiaryResponse = Partial<{
  external_transfer: Partial<{
  id: string;
  slug: string;
  debit_iban: string;
  debit_amount: string;
  debit_amount_cents: string;
  debit_currency: string;
  initiator_id: string;
  beneficiary_id: string;
  credit_amount: string;
  credit_amount_cents: string;
  credit_currency: string;
  reference: string;
  status: string;
  created_at: string;
  scheduled_date: string;
  rate_applied: string;
  payment_purpose: string;
  note: string;
  declined_reason: string;
  completed_at: string;
  processed_at: string;
  transaction_id: string;
}>;
}>;

export type CreateExternalTransfersWithBeneficiaryDataWithoutScaHeaderRequest = Partial<{
  external_transfers: Partial<{
  credit_iban: string;
  credit_account_name: string;
  credit_account_currency: string;
  reference: string;
  currency: string;
  amount: string;
  note: string;
  idempotency_key: string;
}>[];
  debit_iban: string;
}>;

export type CreateExternalTransfersWithBeneficiaryDataWithoutScaHeaderResponse = Partial<{
  external_transfers: Partial<{
  id: string;
  slug: string;
  debit_iban: string;
  debit_amount: string;
  debit_amount_cents: string;
  debit_currency: string;
  initiator_id: string;
  beneficiary_id: string;
  credit_amount: string;
  credit_amount_cents: string;
  credit_currency: string;
  reference: string;
  status: string;
  created_at: string;
  scheduled_date: string;
  rate_applied: string;
  payment_purpose: string;
  note: string;
  declined_reason: string;
  completed_at: string;
  processed_at: string;
  transaction_id: string;
}>[];
  errors: Partial<{
  code: string;
  detail: string;
  source: Partial<{
  pointer: string;
}>;
}>[];
}>;

export type CreateExternalTransfersWithBeneficiaryDataWithScaHeaderRequest = Partial<{
  external_transfers: Partial<{
  credit_iban: string;
  credit_account_name: string;
  credit_account_currency: string;
  reference: string;
  currency: string;
  amount: string;
  note: string;
  idempotency_key: string;
}>[];
  debit_iban: string;
}>;

export type CreateExternalTransfersWithBeneficiaryDataWithScaHeaderResponse = Partial<{
  external_transfers: Partial<{
  id: string;
  slug: string;
  debit_iban: string;
  debit_amount: string;
  debit_amount_cents: string;
  debit_currency: string;
  initiator_id: string;
  beneficiary_id: string;
  credit_amount: string;
  credit_amount_cents: string;
  credit_currency: string;
  reference: string;
  status: string;
  created_at: string;
  scheduled_date: string;
  rate_applied: string;
  payment_purpose: string;
  note: string;
  declined_reason: string;
  completed_at: string;
  processed_at: string;
  transaction_id: string;
}>[];
  errors: Partial<{
  code: string;
  detail: string;
  source: Partial<{
  pointer: string;
}>;
}>[];
}>;

export type ListBeneficiariesResponse = Partial<{
  beneficiaries: Partial<{
  id: string;
  name: string;
  status: string;
  trusted: string;
  created_at: string;
  updated_at: string;
  bank_account: Partial<{
  iban: string;
  bic: string;
  currency: string;
  account_number: string;
  routing_number: string;
  intermediary_bank_bic: string;
  swift_sort_code: string;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export interface ShowBeneficiaryPathParams {
  id: string;
}

export type ShowBeneficiaryResponse = Partial<{
  beneficiary: Partial<{
  id: string;
  name: string;
  status: string;
  trusted: string;
  created_at: string;
  updated_at: string;
  bank_account: Partial<{
  iban: string;
  bic: string;
  currency: string;
  account_number: string;
  routing_number: string;
  intermediary_bank_bic: string;
  swift_sort_code: string;
}>;
}>;
}>;

export type UntrustListOfBeneficiariesRequest = Partial<{
  ids: string[];
}>;

export type UntrustListOfBeneficiariesResponse = Partial<{
  beneficiaries: Partial<{
  id: string;
  name: string;
  status: string;
  trusted: string;
  created_at: string;
  updated_at: string;
  bank_account: Partial<{
  iban: string;
  bic: string;
  currency: string;
  account_number: string;
  routing_number: string;
  intermediary_bank_bic: string;
  swift_sort_code: string;
}>;
}>[];
}>;

export type UploadAttachmentResponse = Partial<{
  attachment: Partial<{
  id: string;
  created_at: string;
  file_name: string;
  file_size: string;
  file_content_type: string;
  url: string;
  probative_attachment: Partial<{
  status: string;
  file_name: string;
  file_content_type: string;
  file_size: string;
  url: string;
}>;
}>;
}>;

export interface ShowAttachmentPathParams {
  id: string;
}

export type ShowAttachmentResponse = Partial<{
  attachment: Partial<{
  id: string;
  created_at: string;
  file_name: string;
  file_size: string;
  file_content_type: string;
  url: string;
  probative_attachment: Partial<{
  status: string;
  file_name: string;
  file_content_type: string;
  file_size: string;
  url: string;
}>;
}>;
}>;

export type ListLabelsResponse = Partial<{
  labels: Partial<{
  id: string;
  name: string;
  parent_id: Partial<{
  nullable: boolean;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export interface ShowLabelPathParams {
  id: string;
}

export type ShowLabelResponse = Partial<{
  label: Partial<{
  id: string;
  name: string;
  parent_id: string;
}>;
}>;

export type ListMembershipsResponse = Partial<{
  memberships: Partial<{
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  residence_country: string;
  birthdate: string;
  nationality: string;
  ubo: string;
  birth_country: string;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type GetDetailsOfSingleMembershipResponse = Partial<{
  membership: Partial<{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  position: string;
  status: string;
  role: string;
  locale: string;
  team_id: string;
}>;
}>;

export type CreateAndInviteNewMembershipRequest = Partial<{
  membership: Partial<{
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  team_id: string;
}>;
}>;

export type CreateAndInviteNewMembershipResponse = Partial<{
  membership: Partial<{
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  locale: string;
  team_id: string;
}>;
}>;

export type GetOrganizationAndItsBankAccountsResponse = Partial<{
  organization: Partial<{
  id: string;
  name: string;
  slug: string;
  legal_name: string;
  locale: string;
  legal_share_capital: string;
  legal_country: string;
  legal_registration_date: string;
  legal_form: string;
  legal_address: string;
  legal_sector: string;
  contract_signed_at: string;
  legal_number: string;
  bank_accounts: Partial<{
  id: string;
  slug: string;
  iban: string;
  bic: string;
  currency: string;
  balance: string;
  balance_cents: string;
  authorized_balance: string;
  authorized_balance_cents: string;
  name: string;
  updated_at: string;
  status: string;
  main: string;
  is_external_account: string;
  account_number: string;
}>[];
}>;
}>;

export interface UploadAttachmentToTransactionPathParams {
  id: string;
}

export type UploadAttachmentToTransactionResponse = any;

export interface ListAttachmentsInTransactionPathParams {
  id: string;
}

export type ListAttachmentsInTransactionResponse = Partial<{
  attachments: Partial<{
  id: string;
  created_at: string;
  file_name: string;
  file_size: string;
  file_content_type: string;
  url: string;
  probative_attachment: Partial<{
  status: string;
  file_name: string;
  file_content_type: string;
  file_size: string;
  url: string;
}>;
}>[];
}>;

export interface RemoveAllAttachmentsFromTransactionPathParams {
  id: string;
}

export type RemoveAllAttachmentsFromTransactionResponse = any;

export interface RemoveAttachmentFromTransactionPathParams {
  id: string;
}

export type RemoveAttachmentFromTransactionResponse = any;

export type ListTransactionsResponse = Partial<{
  transactions: Partial<{
  id: string;
  transaction_id: string;
  amount: string;
  amount_cents: string;
  settled_balance: string;
  settled_balance_cents: number;
  attachment_ids: string[];
  local_amount: string;
  local_amount_cents: string;
  side: string;
  operation_type: string;
  currency: string;
  local_currency: string;
  label: string;
  settled_at: string;
  emitted_at: string;
  updated_at: string;
  status: string;
  note: string;
  reference: string;
  vat_amount: string;
  vat_amount_cents: string;
  vat_rate: string;
  initiator_id: string;
  label_ids: string[];
  attachment_lost: string;
  attachment_required: string;
  card_last_digits: string;
  category: string;
  subject_type: string;
  bank_account_id: string;
  is_external_transaction: string;
  attachments: any[];
  labels: any[];
  vat_details: Partial<{
  items: any[];
}>;
  transfer: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  income: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  swift_income: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  direct_debit: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  check: Partial<{
  check_number: string;
  check_key: string;
}>;
  financing_installment: Partial<{
  total_installments_number: string;
  current_installment_number: string;
}>;
  pagopa_payment: Partial<{
  notice_number: string;
  creditor_fiscal_code: string;
  iuv: string;
}>;
  direct_debit_collection: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  direct_debit_hold: Partial<{
  guarding_rate: string;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
}>;
  total_pages: string;
  total_count: string;
  per_page: number;
}>;
}>;

export interface ShowTransactionPathParams {
  id: string;
}

export type ShowTransactionResponse = Partial<{
  transaction: Partial<{
  id: string;
  transaction_id: string;
  amount: string;
  amount_cents: string;
  settled_balance: string;
  settled_balance_cents: number;
  attachment_ids: string[];
  local_amount: string;
  local_amount_cents: string;
  side: string;
  operation_type: string;
  currency: string;
  local_currency: string;
  label: string;
  settled_at: string;
  emitted_at: string;
  updated_at: string;
  status: string;
  note: string;
  reference: string;
  vat_amount: string;
  vat_amount_cents: string;
  vat_rate: string;
  initiator_id: string;
  label_ids: string[];
  attachment_lost: string;
  attachment_required: string;
  card_last_digits: string;
  category: string;
  subject_type: string;
  bank_account_id: string;
  is_external_transaction: string;
  attachments: Partial<{
  id: string;
  created_at: string;
  file_name: string;
  file_size: string;
  file_content_type: string;
  url: string;
  probative_attachment: any;
}>[];
  labels: Partial<{
  id: string;
  name: string;
  parent_id: string;
}>[];
  vat_details: Partial<{
  items: any[];
}>;
  transfer: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  income: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  swift_income: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  direct_debit: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  check: Partial<{
  check_number: string;
  check_key: string;
}>;
  financing_installment: Partial<{
  total_installments_number: string;
  current_installment_number: string;
}>;
  pagopa_payment: Partial<{
  notice_number: string;
  creditor_fiscal_code: string;
  iuv: string;
}>;
  direct_debit_collection: Partial<{
  counterparty_account_number: string;
  counterparty_account_number_format: string;
  counterparty_bank_identifier: string;
  counterparty_bank_identifier_format: string;
}>;
  direct_debit_hold: Partial<{
  guarding_rate: string;
}>;
}>;
}>;

export type CreateInternalTransferRequest = Partial<{
  internal_transfer: Partial<{
  debit_iban: string;
  credit_iban: string;
  reference: string;
  amount: string;
  currency: string;
}>;
}>;

export type CreateInternalTransferResponse = Partial<{
  internal_transfer: Partial<{
  id: string;
  slug: string;
  status: string;
  amount: string;
  amount_cents: string;
  currency: string;
  reference: string;
  created_at: string;
}>;
}>;

export type ListRequestsResponse = Partial<{
  requests: Partial<{
  id: string;
  request_type: string;
  status: string;
  initiator_id: string;
  approver_id: string;
  note: string;
  declined_note: string;
  pre_expires_at: string;
  payment_lifespan_limit: string;
  currency: string;
  processed_at: string;
  created_at: string;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateMultiTransferRequestRequest = Partial<{
  request_multi_transfer: Partial<{
  note: string;
  transfers: Partial<{
  amount: string;
  currency: string;
  credit_iban: string;
  credit_account_name: string;
  credit_account_currency: string;
  reference: string;
  attachment_ids: string[];
}>[];
  scheduled_date: string;
  debit_iban: string;
}>;
}>;

export type CreateMultiTransferRequestResponse = Partial<{
  request_multi_transfer: Partial<{
  id: string;
  request_type: string;
  status: string;
  initiator_id: string;
  note: string;
  total_transfers_amount: string;
  total_transfers_amount_currency: string;
  total_transfers_count: string;
  created_at: string;
  transfers: Partial<{
  id: string;
  credit_account_name: string;
  amount: string;
  currency: string;
  reference: string;
}>[];
  approver_id: string;
  declined_note: string;
  scheduled_date: string;
  processed_at: string;
}>;
}>;

export interface ApproveRequestPathParams {
  request_type: string;
  id: string;
}

export type ApproveRequestRequest = Partial<{
  debit_iban: string;
}>;

export type ApproveRequestResponse = Partial<{
  request_transfer: Partial<{
  id: string;
  request_type: string;
  status: string;
  initiator_id: string;
  approver_id: string;
  note: string;
  declined_note: string;
  creditor_name: string;
  amount: string;
  currency: string;
  scheduled_date: string;
  recurrence: string;
  last_recurrence_date: string;
  processed_at: string;
  created_at: string;
}>;
}>;

export interface DeclineRequestPathParams {
  request_type: string;
  id: string;
}

export type DeclineRequestRequest = Partial<{
  declined_note: string;
}>;

export type DeclineRequestResponse = Partial<{
  request_virtual_card: Partial<{
  id: string;
  request_type: string;
  status: string;
  initiator_id: string;
  approver_id: string;
  note: string;
  declined_note: string;
  creditor_name: string;
  amount: string;
  currency: string;
  scheduled_date: string;
  recurrence: string;
  last_recurrence_date: string;
  processed_at: string;
  created_at: string;
}>;
}>;

export type GetListOfSupplierInvoicesForOrganizationResponse = Partial<{
  supplier_invoices: Partial<{
  id: string;
  status: string;
  organization_id: string;
  source_type: string;
  attachment_id: string;
  updated_at: string;
  created_at: string;
  file_name: string;
  invoice_number: string;
  supplier_name: string;
  description: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  due_date: string;
  payment_date: string;
  scheduled_date: string;
  iban: string;
  initiator_id: string;
  analyzed_at: string;
  request_transfer: Partial<{
  id: string;
  initiator_id: string;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateSupplierInvoicesWithAttachmentsResponse = Partial<{
  supplier_invoices: Partial<{
  id: string;
  status: string;
  organization_id: string;
  source_type: string;
  attachment_id: string;
  updated_at: string;
  created_at: string;
  file_name: string;
  invoice_number: string;
  supplier_name: string;
  description: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  due_date: string;
  payment_date: string;
  scheduled_date: string;
  iban: string;
  initiator_id: string;
  analyzed_at: string;
  request_transfer: Partial<{
  id: string;
  initiator_id: string;
}>;
}>[];
  errors: Partial<{
  code: string;
  detail: string;
}>[];
}>;

export type GetListOfClientInvoicesForOrganizationResponse = Partial<{
  client_invoices: Partial<{
  id: string;
  organization_id: string;
  attachment_id: string;
  issue_date: string;
  due_date: string;
  performance_date: string;
  status: string;
  number: string;
  purchase_order: string;
  terms_and_conditions: string;
  discount_conditions: string;
  late_payment_penalties: string;
  legal_fixed_compensation: string;
  header: string;
  footer: string;
  vat_amount: Partial<{
  value: string;
  currency: string;
}>;
  vat_amount_cents: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  total_amount_cents: string;
  currency: string;
  created_at: string;
  paid_at: string;
  finalized_at: string;
  contact_email: string;
  invoice_url: string;
  payment_methods: any[];
  credit_note_ids: any[];
  einvoicing_status: string;
  welfare_fund: Partial<{
  type: string;
  rate: string;
}>;
  withholding_tax: Partial<{
  rate: string;
  reason: string;
  payment_reason: string;
}>;
  stamp_duty_amount: string;
  payment_reporting: Partial<{
  conditions: string;
  method: string;
}>;
  items: any[];
  client: Partial<{
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  recipient_code: string;
  locale: string;
  billing_address: any;
  delivery_address: any;
}>;
  organization: Partial<{
  id: string;
  legal_name: string;
  legal_number: string;
  legal_country: string;
  address_line_1: string;
  address_line_2: string;
  address_zipcode: string;
  address_city: string;
  address_country: string;
  company_leadership: string;
  district_court: string;
  commercial_register_number: string;
  vat_number: string;
  tax_number: string;
  legal_capital_share: any;
  transaction_type: string;
  vat_payment_condition: string;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateClientInvoiceRequest = Partial<{
  client_id: string;
  issue_date: string;
  due_date: string;
  number: string;
  currency: string;
  items: Partial<{
  title: string;
  quantity: string;
  unit_price: Partial<{
  value: string;
  currency: string;
}>;
  vat_rate: string;
  description: string;
  unit: string;
  vat_exemption_reason: string;
  discount: Partial<{
  type: string;
  value: string;
}>;
}>[];
  payment_methods: Partial<{
  iban: string;
}>;
  performance_date: string;
  status: string;
  purchase_order: string;
  terms_and_conditions: string;
  header: string;
  footer: string;
  settings: Partial<{
  vat_number: string;
  company_leadership: string;
  district_court: string;
  commercial_register_number: string;
  tax_number: string;
  legal_capital_share: Partial<{
  value: string;
  currency: string;
}>;
  transaction_type: string;
  vat_payment_condition: string;
  discount_conditions: string;
  late_payment_penalties: string;
  legal_fixed_compensation: string;
}>;
  report_einvoicing: string;
  payment_reporting: Partial<{
  conditions: string;
  method: string;
}>;
  welfare_fund: Partial<{
  rate: string;
  type: string;
}>;
  withholding_tax: Partial<{
  rate: string;
  reason: string;
  payment_reason: string;
}>;
  stamp_duty_amount: string;
}>;

export type CreateClientInvoiceResponse = Partial<{
  client_invoice: Partial<{
  id: string;
  organization_id: string;
  attachment_id: string;
  issue_date: string;
  due_date: string;
  performance_date: string;
  status: string;
  number: string;
  purchase_order: string;
  terms_and_conditions: string;
  discount_conditions: string;
  late_payment_penalties: string;
  legal_fixed_compensation: string;
  header: string;
  footer: string;
  vat_amount: Partial<{
  value: string;
  currency: string;
}>;
  vat_amount_cents: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  total_amount_cents: string;
  currency: string;
  created_at: string;
  paid_at: string;
  finalized_at: string;
  contact_email: string;
  invoice_url: string;
  payment_methods: Partial<{
  beneficiary_name: string;
  bic: string;
  iban: string;
  type: string;
}>[];
  credit_note_ids: Partial<{
  id: string;
}>[];
  einvoicing_status: string;
  welfare_fund: Partial<{
  type: string;
  rate: string;
}>;
  withholding_tax: Partial<{
  rate: string;
  reason: string;
  payment_reason: string;
}>;
  stamp_duty_amount: string;
  payment_reporting: Partial<{
  conditions: string;
  method: string;
}>;
  items: Partial<{
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: any;
  unit_price_cents: string;
  vat_rate: string;
  vat_exemption_reason: string;
  discount: any;
  total_vat: any;
  total_vat_cents: string;
  total_amount: any;
  total_amount_cents: string;
  subtotal: any;
  subtotal_cents: string;
}>[];
  client: Partial<{
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  recipient_code: string;
  locale: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
}>;
  organization: Partial<{
  id: string;
  legal_name: string;
  legal_number: string;
  legal_country: string;
  address_line_1: string;
  address_line_2: string;
  address_zipcode: string;
  address_city: string;
  address_country: string;
  company_leadership: string;
  district_court: string;
  commercial_register_number: string;
  vat_number: string;
  tax_number: string;
  legal_capital_share: Partial<{
  value: string;
  currency: string;
}>;
  transaction_type: string;
  vat_payment_condition: string;
}>;
}>;
}>;

export interface ShowClientInvoicePathParams {
  id: string;
}

export type ShowClientInvoiceResponse = Partial<{
  client_invoice: Partial<{
  id: string;
  organization_id: string;
  attachment_id: string;
  number: string;
  purchase_order: string;
  status: string;
  invoice_url: string;
  contact_email: string;
  terms_and_conditions: string;
  discount_conditions: string;
  late_payment_penalties: string;
  legal_fixed_compensation: string;
  header: string;
  footer: string;
  currency: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  total_amount_cents: string;
  vat_amount: Partial<{
  value: string;
  currency: string;
}>;
  vat_amount_cents: string;
  issue_date: string;
  due_date: string;
  performance_date: string;
  created_at: string;
  finalized_at: string;
  paid_at: string;
  stamp_duty_amount: string;
  items: Partial<{
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: any;
  unit_price_cents: string;
  vat_rate: string;
  vat_exemption_reason: string;
  discount: any;
  total_vat: any;
  total_vat_cents: string;
  total_amount: any;
  total_amount_cents: string;
  subtotal: any;
  subtotal_cents: string;
}>[];
  client: Partial<{
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  recipient_code: string;
  locale: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
}>;
  payment_methods: Partial<{
  beneficiary_name: string;
  bic: string;
  iban: string;
  type: string;
}>[];
  credit_notes_ids: string[];
  organization: Partial<{
  id: string;
  legal_name: string;
  legal_number: string;
  legal_country: string;
  address_line_1: string;
  address_line_2: string;
  address_zipcode: string;
  address_city: string;
  address_country: string;
  company_leadership: string;
  district_court: string;
  commercial_register_number: string;
  vat_number: string;
  tax_number: string;
  legal_capital_share: Partial<{
  value: string;
  currency: string;
}>;
  transaction_type: string;
  vat_payment_condition: string;
}>;
  einvoicing_status: string;
  welfare_fund: Partial<{
  type: string;
  rate: string;
}>;
  withholding_tax: Partial<{
  reason: string;
  rate: string;
  payment_reason: string;
}>;
  payment_reporting: Partial<{
  conditions: string;
  method: string;
}>;
}>;
}>;

export type GetListOfCreditNotesForOrganizationResponse = Partial<{
  credit_notes: Partial<{
  id: string;
  invoice_id: string;
  attachment_id: string;
  issue_date: string;
  invoice_issue_date: string;
  number: string;
  terms_and_conditions: string;
  header: string;
  footer: string;
  vat_amount: Partial<{
  value: string;
  currency: string;
}>;
  vat_amount_cents: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  total_amount_cents: string;
  currency: string;
  created_at: string;
  finalized_at: string;
  contact_email: string;
  invoice_url: string;
  einvoicing_status: string;
  welfare_fund: Partial<{
  type: string;
  rate: string;
}>;
  withholding_tax: Partial<{
  rate: string;
  reason: string;
  payment_reason: string;
}>;
  stamp_duty_amount: string;
  items: any[];
  client: Partial<{
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  recipient_code: string;
  locale: string;
  billing_address: any;
  delivery_address: any;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export interface GetDetailsOfCreditNoteForOrganizationPathParams {
  id: string;
}

export type GetDetailsOfCreditNoteForOrganizationResponse = Partial<{
  credit_note: Partial<{
  id: string;
  invoice_id: string;
  attachment_id: string;
  issue_date: string;
  invoice_issue_date: string;
  number: string;
  terms_and_conditions: string;
  header: string;
  footer: string;
  vat_amount: Partial<{
  value: string;
  currency: string;
}>;
  vat_amount_cents: string;
  total_amount: Partial<{
  value: string;
  currency: string;
}>;
  total_amount_cents: string;
  currency: string;
  created_at: string;
  finalized_at: string;
  contact_email: string;
  invoice_url: string;
  einvoicing_status: string;
  welfare_fund: Partial<{
  type: string;
  rate: string;
}>;
  withholding_tax: Partial<{
  rate: string;
  reason: string;
  payment_reason: string;
}>;
  stamp_duty_amount: string;
  items: Partial<{
  title: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: any;
  unit_price_cents: string;
  vat_rate: string;
  vat_exemption_reason: string;
  discount: any;
  total_vat: any;
  total_vat_cents: string;
  total_amount: any;
  total_amount_cents: string;
  subtotal: any;
  subtotal_cents: string;
}>[];
  client: Partial<{
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  recipient_code: string;
  locale: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
}>;
}>;
}>;

export interface GetClientSDetailsPathParams {
  id: string;
}

export type GetClientSDetailsResponse = Partial<{
  client: Partial<{
  id: string;
  name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  recipient_code: string;
  created_at: string;
  locale: string;
}>;
}>;

export type GetListOfClientsResponse = Partial<{
  clients: Partial<{
  id: string;
  name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  recipient_code: string;
  created_at: string;
  locale: string;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateClientRequest = Partial<{
  first_name: string;
  last_name: string;
  type: string;
  name: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  recipient_code: string;
  currency: string;
  locale: string;
}>;

export type CreateClientResponse = Partial<{
  client: Partial<{
  id: string;
  name: string;
  type: string;
  email: string;
  vat_number: string;
  tax_identification_number: string;
  address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
  billing_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  delivery_address: Partial<{
  street_address: string;
  city: string;
  zip_code: string;
  province_code: string;
  country_code: string;
}>;
  recipient_code: string;
  created_at: string;
  locale: string;
}>;
}>;

export type ListTeamsInOrganizationResponse = Partial<{
  teams: Partial<{
  id: string;
  name: string;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;

export type CreateNewTeamRequest = Partial<{
  name: string;
}>;

export type CreateNewTeamResponse = Partial<{
  team: Partial<{
  id: string;
  name: string;
}>;
}>;

export interface ShowStatementPathParams {
  id: string;
}

export type ShowStatementResponse = Partial<{
  statement: Partial<{
  id: string;
  bank_account_id: string;
  period: string;
  file: Partial<{
  file_name: string;
  file_content_type: string;
  file_size: string;
  file_url: string;
}>;
}>;
}>;

export type ListStatementsResponse = Partial<{
  statements: Partial<{
  id: string;
  bank_account_id: string;
  period: string;
  file: Partial<{
  file_name: string;
  file_content_type: string;
  file_size: string;
  file_url: string;
}>;
}>[];
  meta: Partial<{
  current_page: string;
  next_page: Partial<{
  nullable: boolean;
}>;
  prev_page: Partial<{
  nullable: boolean;
  example: number;
}>;
  total_pages: string;
  total_count: string;
  per_page: string;
}>;
}>;



// API Client
export class QontoApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: { baseUrl: string; login: string; secretKey: string; stagingToken?: string; }) {
    this.baseUrl = config.baseUrl || 'https://thirdparty.qonto.com';
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': config.login + ':' + config.secretKey
    };
    if (config.stagingToken) {
      this.headers['X-Qonto-Staging-Token'] = config.stagingToken;
    }
  }

  protected async request<T>(method: string, path: string, data?: any, params?: Record<string, any>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: this.headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error('Qonto API Error: ' + response.status + ' - ' + JSON.stringify(error));
    }

    return response.json();
  }

  showExternalTransfer(pathParams: ShowExternalTransferPathParams, queryParams?: Record<string, any>): Promise<ShowExternalTransferResponse> {
    const path = '/v2/external_transfers/:id'.replace(':id', pathParams.id);
    return this.request<ShowExternalTransferResponse>('get', path, undefined, queryParams);
  }

  listExternalTransfers(queryParams?: Record<string, any>): Promise<ListExternalTransfersResponse> {
    const path = '/v2/external_transfers';
    return this.request<ListExternalTransfersResponse>('get', path, undefined, queryParams);
  }

  createExternalTransferWithTrustedBeneficiary(data: CreateExternalTransferWithTrustedBeneficiaryRequest, queryParams?: Record<string, any>): Promise<CreateExternalTransferWithTrustedBeneficiaryResponse> {
    const path = '/v2/external_transfers';
    return this.request<CreateExternalTransferWithTrustedBeneficiaryResponse>('post', path, data, queryParams);
  }

  createExternalTransfersWithBeneficiaryDataWithoutScaHeader(data: CreateExternalTransfersWithBeneficiaryDataWithoutScaHeaderRequest, queryParams?: Record<string, any>): Promise<CreateExternalTransfersWithBeneficiaryDataWithoutScaHeaderResponse> {
    const path = '/v2/external_transfers/checkout';
    return this.request<CreateExternalTransfersWithBeneficiaryDataWithoutScaHeaderResponse>('post', path, data, queryParams);
  }

  createExternalTransfersWithBeneficiaryDataWithScaHeader(data: CreateExternalTransfersWithBeneficiaryDataWithScaHeaderRequest, queryParams?: Record<string, any>): Promise<CreateExternalTransfersWithBeneficiaryDataWithScaHeaderResponse> {
    const path = '/v2/external_transfers/checkout';
    return this.request<CreateExternalTransfersWithBeneficiaryDataWithScaHeaderResponse>('post', path, data, queryParams);
  }

  listBeneficiaries(queryParams?: Record<string, any>): Promise<ListBeneficiariesResponse> {
    const path = '/v2/beneficiaries';
    return this.request<ListBeneficiariesResponse>('get', path, undefined, queryParams);
  }

  showBeneficiary(pathParams: ShowBeneficiaryPathParams, queryParams?: Record<string, any>): Promise<ShowBeneficiaryResponse> {
    const path = '/v2/beneficiaries/:id'.replace(':id', pathParams.id);
    return this.request<ShowBeneficiaryResponse>('get', path, undefined, queryParams);
  }

  untrustListOfBeneficiaries(data: UntrustListOfBeneficiariesRequest, queryParams?: Record<string, any>): Promise<UntrustListOfBeneficiariesResponse> {
    const path = '/v2/beneficiaries/untrust';
    return this.request<UntrustListOfBeneficiariesResponse>('patch', path, data, queryParams);
  }

  uploadAttachment(queryParams?: Record<string, any>): Promise<UploadAttachmentResponse> {
    const path = '/v2/attachments';
    return this.request<UploadAttachmentResponse>('post', path, undefined, queryParams);
  }

  showAttachment(pathParams: ShowAttachmentPathParams, queryParams?: Record<string, any>): Promise<ShowAttachmentResponse> {
    const path = '/v2/attachments/:id'.replace(':id', pathParams.id);
    return this.request<ShowAttachmentResponse>('get', path, undefined, queryParams);
  }

  listLabels(queryParams?: Record<string, any>): Promise<ListLabelsResponse> {
    const path = '/v2/labels';
    return this.request<ListLabelsResponse>('get', path, undefined, queryParams);
  }

  showLabel(pathParams: ShowLabelPathParams, queryParams?: Record<string, any>): Promise<ShowLabelResponse> {
    const path = '/v2/labels/:id'.replace(':id', pathParams.id);
    return this.request<ShowLabelResponse>('get', path, undefined, queryParams);
  }

  listMemberships(queryParams?: Record<string, any>): Promise<ListMembershipsResponse> {
    const path = '/v2/memberships';
    return this.request<ListMembershipsResponse>('get', path, undefined, queryParams);
  }

  getDetailsOfSingleMembership(queryParams?: Record<string, any>): Promise<GetDetailsOfSingleMembershipResponse> {
    const path = '/v2/membership';
    return this.request<GetDetailsOfSingleMembershipResponse>('get', path, undefined, queryParams);
  }

  createAndInviteNewMembership(data: CreateAndInviteNewMembershipRequest, queryParams?: Record<string, any>): Promise<CreateAndInviteNewMembershipResponse> {
    const path = '/v2/memberships/invite_employee_or_accountant';
    return this.request<CreateAndInviteNewMembershipResponse>('post', path, data, queryParams);
  }

  getOrganizationAndItsBankAccounts(queryParams?: Record<string, any>): Promise<GetOrganizationAndItsBankAccountsResponse> {
    const path = '/v2/organization';
    return this.request<GetOrganizationAndItsBankAccountsResponse>('get', path, undefined, queryParams);
  }

  uploadAttachmentToTransaction(pathParams: UploadAttachmentToTransactionPathParams, queryParams?: Record<string, any>): Promise<UploadAttachmentToTransactionResponse> {
    const path = '/v2/transactions/:id/attachments'.replace(':id', pathParams.id);
    return this.request<UploadAttachmentToTransactionResponse>('post', path, undefined, queryParams);
  }

  listAttachmentsInTransaction(pathParams: ListAttachmentsInTransactionPathParams, queryParams?: Record<string, any>): Promise<ListAttachmentsInTransactionResponse> {
    const path = '/v2/transactions/:id/attachments'.replace(':id', pathParams.id);
    return this.request<ListAttachmentsInTransactionResponse>('get', path, undefined, queryParams);
  }

  removeAllAttachmentsFromTransaction(pathParams: RemoveAllAttachmentsFromTransactionPathParams, queryParams?: Record<string, any>): Promise<RemoveAllAttachmentsFromTransactionResponse> {
    const path = '/v2/transactions/:id/attachments'.replace(':id', pathParams.id);
    return this.request<RemoveAllAttachmentsFromTransactionResponse>('delete', path, undefined, queryParams);
  }

  removeAttachmentFromTransaction(pathParams: RemoveAttachmentFromTransactionPathParams, queryParams?: Record<string, any>): Promise<RemoveAttachmentFromTransactionResponse> {
    const path = '/v2/transactions/:id/attachments/:id'.replace(':id', pathParams.id);
    return this.request<RemoveAttachmentFromTransactionResponse>('delete', path, undefined, queryParams);
  }

  listTransactions(queryParams?: Record<string, any>): Promise<ListTransactionsResponse> {
    const path = '/v2/transactions';
    return this.request<ListTransactionsResponse>('get', path, undefined, queryParams);
  }

  showTransaction(pathParams: ShowTransactionPathParams, queryParams?: Record<string, any>): Promise<ShowTransactionResponse> {
    const path = '/v2/transactions/:id'.replace(':id', pathParams.id);
    return this.request<ShowTransactionResponse>('get', path, undefined, queryParams);
  }

  createInternalTransfer(data: CreateInternalTransferRequest, queryParams?: Record<string, any>): Promise<CreateInternalTransferResponse> {
    const path = '/v2/internal_transfers';
    return this.request<CreateInternalTransferResponse>('post', path, data, queryParams);
  }

  listRequests(queryParams?: Record<string, any>): Promise<ListRequestsResponse> {
    const path = '/v2/requests';
    return this.request<ListRequestsResponse>('get', path, undefined, queryParams);
  }

  createMultiTransferRequest(data: CreateMultiTransferRequestRequest, queryParams?: Record<string, any>): Promise<CreateMultiTransferRequestResponse> {
    const path = '/v2/requests/multi_transfers';
    return this.request<CreateMultiTransferRequestResponse>('post', path, data, queryParams);
  }

  approveRequest(pathParams: ApproveRequestPathParams, data: ApproveRequestRequest, queryParams?: Record<string, any>): Promise<ApproveRequestResponse> {
    const path = '/v2/requests/:request_type/:id/approve'.replace(':request_type', pathParams.request_type).replace(':id', pathParams.id);
    return this.request<ApproveRequestResponse>('post', path, data, queryParams);
  }

  declineRequest(pathParams: DeclineRequestPathParams, data: DeclineRequestRequest, queryParams?: Record<string, any>): Promise<DeclineRequestResponse> {
    const path = '/v2/requests/:request_type/:id/decline'.replace(':request_type', pathParams.request_type).replace(':id', pathParams.id);
    return this.request<DeclineRequestResponse>('post', path, data, queryParams);
  }

  getListOfSupplierInvoicesForOrganization(queryParams?: Record<string, any>): Promise<GetListOfSupplierInvoicesForOrganizationResponse> {
    const path = '/v2/supplier_invoices';
    return this.request<GetListOfSupplierInvoicesForOrganizationResponse>('get', path, undefined, queryParams);
  }

  createSupplierInvoicesWithAttachments(queryParams?: Record<string, any>): Promise<CreateSupplierInvoicesWithAttachmentsResponse> {
    const path = '/v2/supplier_invoices/bulk';
    return this.request<CreateSupplierInvoicesWithAttachmentsResponse>('post', path, undefined, queryParams);
  }

  getListOfClientInvoicesForOrganization(queryParams?: Record<string, any>): Promise<GetListOfClientInvoicesForOrganizationResponse> {
    const path = '/v2/client_invoices';
    return this.request<GetListOfClientInvoicesForOrganizationResponse>('get', path, undefined, queryParams);
  }

  createClientInvoice(data: CreateClientInvoiceRequest, queryParams?: Record<string, any>): Promise<CreateClientInvoiceResponse> {
    const path = '/v2/client_invoices';
    return this.request<CreateClientInvoiceResponse>('post', path, data, queryParams);
  }

  showClientInvoice(pathParams: ShowClientInvoicePathParams, queryParams?: Record<string, any>): Promise<ShowClientInvoiceResponse> {
    const path = '/v2/client_invoices/:id'.replace(':id', pathParams.id);
    return this.request<ShowClientInvoiceResponse>('get', path, undefined, queryParams);
  }

  getListOfCreditNotesForOrganization(queryParams?: Record<string, any>): Promise<GetListOfCreditNotesForOrganizationResponse> {
    const path = '/v2/credit_notes';
    return this.request<GetListOfCreditNotesForOrganizationResponse>('get', path, undefined, queryParams);
  }

  getDetailsOfCreditNoteForOrganization(pathParams: GetDetailsOfCreditNoteForOrganizationPathParams, queryParams?: Record<string, any>): Promise<GetDetailsOfCreditNoteForOrganizationResponse> {
    const path = '/v2/credit_notes/:id'.replace(':id', pathParams.id);
    return this.request<GetDetailsOfCreditNoteForOrganizationResponse>('get', path, undefined, queryParams);
  }

  getClientSDetails(pathParams: GetClientSDetailsPathParams, queryParams?: Record<string, any>): Promise<GetClientSDetailsResponse> {
    const path = '/v2/clients/:id'.replace(':id', pathParams.id);
    return this.request<GetClientSDetailsResponse>('get', path, undefined, queryParams);
  }

  getListOfClients(queryParams?: Record<string, any>): Promise<GetListOfClientsResponse> {
    const path = '/v2/clients';
    return this.request<GetListOfClientsResponse>('get', path, undefined, queryParams);
  }

  createClient(data: CreateClientRequest, queryParams?: Record<string, any>): Promise<CreateClientResponse> {
    const path = '/v2/clients';
    return this.request<CreateClientResponse>('post', path, data, queryParams);
  }

  listTeamsInOrganization(queryParams?: Record<string, any>): Promise<ListTeamsInOrganizationResponse> {
    const path = '/v2/teams';
    return this.request<ListTeamsInOrganizationResponse>('get', path, undefined, queryParams);
  }

  createNewTeam(data: CreateNewTeamRequest, queryParams?: Record<string, any>): Promise<CreateNewTeamResponse> {
    const path = '/v2/teams';
    return this.request<CreateNewTeamResponse>('post', path, data, queryParams);
  }

  showStatement(pathParams: ShowStatementPathParams, queryParams?: Record<string, any>): Promise<ShowStatementResponse> {
    const path = '/v2/statements/:id'.replace(':id', pathParams.id);
    return this.request<ShowStatementResponse>('get', path, undefined, queryParams);
  }

  listStatements(queryParams?: Record<string, any>): Promise<ListStatementsResponse> {
    const path = '/v2/statements';
    return this.request<ListStatementsResponse>('get', path, undefined, queryParams);
  }
}

export default QontoApi;
