// Database types matching Supabase schema

export type UserRole = 'super_admin' | 'admin' | 'front_desk' | 'technician' | 'viewer'
export type DeviceStatus = 'in_stock' | 'assigned' | 'maintenance' | 'retired' | 'lost'
export type DeviceType =
  | 'car_tracker'
  | 'ip_camera'
  | 'starlink'
  | 'wifi_access_point'
  | 'tv'
  | 'drone'
  | 'printer'
  | 'websuite'
  | 'isp_link'
  | 'other'
export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'expired'
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one_time'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
export type ProviderPaymentStatus = 'scheduled' | 'pending' | 'paid' | 'overdue' | 'canceled'
export type AssignmentStatus = 'active' | 'completed'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  industry: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  billing_address: string | null
  tax_number: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  device_type: DeviceType
  name: string | null
  status: DeviceStatus
  serial_number: string | null
  identifier: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  environment: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CarTracker {
  device_id: string
  brand: string | null
  model: string | null
  sim_number: string | null
  user_tel: string | null
  vehicle_model: string | null
  reg_number: string | null
  color: string | null
  server: string | null
  port: string | null
  imei: string | null
  pwd: string | null
  email: string | null
  install_date: string | null
  sms_notification: boolean
  remote_cut_off: boolean
  last_top_up: string | null
}

export interface IpCamera {
  device_id: string
  camera_type: string | null
  range: string | null
}

export interface Starlink {
  device_id: string
  account: string | null
  subscription: string | null
  amount: number | null
  currency: string | null
  renewal_date: string | null
  registration_date: string | null
  service_period: string | null
}

export interface WifiAccessPoint {
  device_id: string
  ap_type: string | null
  range: string | null
  console: string | null
}

export interface Tv {
  device_id: string
  tv_type: string | null
  speakers: string | null
}

export interface Drone {
  device_id: string
  drone_type: string | null
  range: string | null
}

export interface Printer {
  device_id: string
  username: string | null
  password: string | null
  ip_address: string | null
}

export interface Websuite {
  device_id: string
  package: string | null
  domain: string | null
}

export interface IspLink {
  device_id: string
  link_type: string | null
  line_number: string | null
  wlan_pwd: string | null
  acc_pwd: string | null
  modem_user: string | null
  modem_pwd: string | null
  ip_address: string | null
  provider: string | null
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  billing_cycle: BillingCycle
  amount: number
  currency: string | null
  applicable_device_types: DeviceType[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DeviceAssignment {
  id: string
  device_id: string
  client_id: string
  assigned_by: string | null
  assigned_at: string
  unassigned_at: string | null
  status: AssignmentStatus
  notes: string | null
}

export interface Subscription {
  id: string
  device_id: string | null
  client_id: string
  plan_id: string | null
  plan_name: string
  billing_cycle: BillingCycle
  amount: number
  currency: string | null
  start_date: string
  end_date: string | null
  next_invoice_date: string | null
  status: SubscriptionStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientInvoice {
  id: string
  client_id: string
  subscription_id: string | null
  plan_id: string | null
  device_id: string | null
  invoice_number: string
  period_start: string | null
  period_end: string | null
  amount: number
  currency: string | null
  status: InvoiceStatus
  issued_at: string | null
  due_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Provider {
  id: string
  name: string
  provider_type: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  account_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProviderPlan {
  id: string
  provider_id: string
  name: string
  description: string | null
  billing_cycle: BillingCycle
  amount: number
  currency: string | null
  applicable_device_types: DeviceType[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type DeviceProviderPlanStatus = 'active' | 'canceled' | 'ended'

export interface DeviceProviderPlan {
  id: string
  device_id: string
  provider_plan_id: string
  start_date: string
  end_date: string | null
  status: DeviceProviderPlanStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProviderPayment {
  id: string
  provider_id: string
  provider_plan_id: string | null
  device_id: string | null
  description: string | null
  amount: number
  currency: string | null
  status: ProviderPaymentStatus
  due_at: string | null
  paid_at: string | null
  invoice_ref: string | null
  service_period_start: string | null
  service_period_end: string | null
  created_at: string
  updated_at: string
}

export interface ImportJob {
  id: string
  source_file: string | null
  entity_type: string | null
  total_rows: number | null
  success_rows: number | null
  failed_rows: number | null
  status: string | null
  created_by: string | null
  created_at: string
}

// Joined/aggregated types for UI
export interface DeviceWithDetails extends Device {
  car_tracker?: CarTracker | null
  ip_camera?: IpCamera | null
  starlink?: Starlink | null
  wifi_access_point?: WifiAccessPoint | null
  tv?: Tv | null
  drone?: Drone | null
  printer?: Printer | null
  websuite?: Websuite | null
  isp_link?: IspLink | null
  client?: Client | null
  assignment?: DeviceAssignment | null
}

// Unified alerts (Alerts page + notifications)
export type AlertType =
  | 'overdue_invoice'
  | 'overdue_subscription'
  | 'renewal_due'
  | 'subscription_ending_soon'
  | 'device_maintenance_long'
  | 'client_mail_sent'
  | 'client_mail_broadcast'

export type AlertSeverity = 'high' | 'medium' | 'low'

export interface UnifiedAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  date: string
  title: string
  subtitle: string
  link: string
  entityType: string
  entityId: string
}

export interface Notification {
  id: string
  user_id: string
  type: AlertType
  title: string
  body: string | null
  entity_type: string
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  overdue_invoice: 'Overdue invoices',
  overdue_subscription: 'Overdue subscriptions',
  renewal_due: 'Renewals due',
  subscription_ending_soon: 'Subscriptions ending soon',
  device_maintenance_long: 'Devices in maintenance',
  client_mail_sent: 'Emails sent',
  client_mail_broadcast: 'Mail broadcasts',
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  car_tracker: 'Car Trackers',
  ip_camera: 'IP Cameras',
  starlink: 'Starlinks',
  wifi_access_point: 'WiFi Access Points',
  tv: 'TVs',
  drone: 'Drones',
  printer: 'Printers',
  websuite: 'Websuites',
  isp_link: 'ISP Links',
  other: 'Other',
}
