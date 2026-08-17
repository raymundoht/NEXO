import { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { WarehouseView } from "@/components/inventory/warehouse-view";

export const metadata: Metadata = {
  title: "Gestión de Almacenes | NEXO ERP"
};

export default async function InventoryWarehousePage() {
  await requirePermission("inventory.read");
  return <WarehouseView />;
}
