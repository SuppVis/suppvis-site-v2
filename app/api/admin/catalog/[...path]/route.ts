import type { NextRequest } from "next/server";
import { proxyCatalogAdminRequest } from "@/app/lib/server/catalog-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return proxyCatalogAdminRequest(request);
}

export function POST(request: NextRequest) {
  return proxyCatalogAdminRequest(request);
}

export function PATCH(request: NextRequest) {
  return proxyCatalogAdminRequest(request);
}
