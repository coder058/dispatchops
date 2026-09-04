export type Role = "dispatcher" | "viewer";
export type JobStatus = "unassigned" | "assigned" | "in_transit" | "delivered" | "exception";
export type DriverStatus = "available" | "active" | "break" | "offline";
export type Priority = "urgent" | "high" | "normal";
export type RecommendationStatus = "pending" | "approved" | "dismissed";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface JobRecord {
  id: number;
  reference: string;
  customer: string;
  address: string;
  region: string;
  service: string;
  due_at: string;
  priority: Priority;
  status: JobStatus;
  driver_id: number | null;
  driver_name: string | null;
  eta_minutes: number | null;
  lat: number;
  lng: number;
  created_at: string;
}

export interface DriverRecord {
  id: number;
  name: string;
  status: DriverStatus;
  region: string;
  capacity: number;
  current_load: number;
  skills: string[];
}

export interface RecommendationRecord {
  id: number;
  kind: "assignment";
  summary: string;
  rationale: string[];
  job_id: number;
  job_reference: string;
  driver_id: number;
  driver_name: string;
  status: RecommendationStatus;
  created_at: string;
}

export interface AlertRecord {
  id: number;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  job_id: number | null;
  resolved: boolean;
  created_at: string;
}
