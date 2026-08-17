import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

export async function requirePagePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) notFound();
  return user;
}

export async function requireAnyPagePermission(permissions: Permission[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!permissions.some((p) => can(user.role, p))) notFound();
  return user;
}
