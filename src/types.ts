export type Role = "dispatcher" | "viewer";
export type JobStatus = "unassigned" | "assigned" | "in_transit" | "delivered" | "exception";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Job {
  id: number;
  reference: string;
  customer: string;
  address: string;
  region: string;
  service: string;
  due_at: string;
  priority: "urgent" | "high" | "normal";
  status: JobStatus;
  driver_id: number | null;
  driver_name: string | null;
  eta_minutes: number | null;
  lat: number;
  lng: number;
}

export interface Driver {
  id: number;
  name: string;
  status: "available" | "active" | "break" | "offline";
  region: string;
  capacity: number;
  current_load: number;
  skills: string[];
}

export interface Alert {
  id: number;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  job_id: number | null;
  resolved: boolean;
  created_at: string;
}

export interface Recommendation {
  id: number;
  summary: string;
  rationale: string[];
  job_id: number;
  job_reference: string;
  driver_id: number;
  driver_name: string;
  status: "pending" | "approved" | "dismissed";
  created_at: string;
}

export interface Overview {
  totals: {
    openJobs: number;
    unassigned: number;
    inTransit: number;
    exceptions: number;
    availableDrivers: number;
  };
  jobs: Job[];
  drivers: Driver[];
  alerts: Alert[];
  recommendations: Recommendation[];
}
