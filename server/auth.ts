import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser, Role } from "./types.js";

const COOKIE_NAME = "dispatchops_session";
const LOCAL_SECRET = "dispatchops-local-development-secret"; // SOURCE: local-only fallback; production rejects this value.
const SESSION_HOURS = 8; // SOURCE: one standard dispatcher shift; change with the security policy in production.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function hashPassword(password: string): string {
  const rounds = 10; // SOURCE: bcryptjs documented default work factor and adequate for local demo accounts.
  return bcrypt.hashSync(password, rounds);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function secret(): string {
  const value = process.env.JWT_SECRET ?? LOCAL_SECRET;
  if (process.env.NODE_ENV === "production" && value === LOCAL_SECRET) {
    throw new Error("JWT_SECRET must be configured in production");
  }
  return value;
}

export function issueSession(res: Response, user: AuthUser): void {
  const token = jwt.sign(user, secret(), { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 60 * 60 * 1000, // SOURCE: SESSION_HOURS converted to milliseconds.
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = cookieValue(req, COOKIE_NAME);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.user = jwt.verify(token, secret()) as AuthUser;
    next();
  } catch {
    clearSession(res);
    res.status(401).json({ error: "Session expired or invalid" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
