import { Package, Ticket, Zap } from "lucide-react";
import { catalogueInfo, type CatalogueIcon } from "../presentation/catalogue.ts";

const ICONS: Record<CatalogueIcon, typeof Package> = { package: Package, ticket: Ticket, zap: Zap };

/** Penanda jenis produk: Paket Data, Data Voucher, atau Kuota Elektrik. */
export function TypeChip({ catalogue }: { catalogue: string }) {
  const info = catalogueInfo(catalogue);
  const Icon = info.icon ? ICONS[info.icon] : null;
  return (
    <span className={`type t-${info.key}`} title={`Jenis: ${info.label}`}>
      {Icon && <Icon size={12} strokeWidth={2.3} aria-hidden />}
      {info.label}
    </span>
  );
}
