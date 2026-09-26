import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/app/lib/server/admin-session";
import { handleApiError } from "@/app/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABEL_ID = /^[1-9][0-9]{0,9}$/;

export async function GET(
  _request: NextRequest,
  context: { params: { labelId: string } },
) {
  try {
    await requireAdminSession();
    const { labelId } = context.params;
    if (!LABEL_ID.test(labelId)) {
      return NextResponse.json({ error: "Invalid DSLD label ID." }, { status: 400 });
    }

    const source = await fetch(`https://api.ods.od.nih.gov/dsld/s3/pdf/${labelId}.pdf`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!source.ok || !source.body || !source.headers.get("content-type")?.includes("application/pdf")) {
      return NextResponse.json({ error: "The DSLD label PDF is unavailable." }, { status: 502 });
    }
    return new NextResponse(source.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="dsld-label-${labelId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
