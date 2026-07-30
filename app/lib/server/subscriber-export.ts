import {
  buildXlsxWorkbook,
  type XlsxWorksheet,
} from "@/app/lib/server/xlsx";
import type {
  AdminBetaSubscriber,
  AdminSubscriberPriorityFilter,
  AdminSubscriberSort,
} from "@/app/lib/server/beta-subscribers";

export function subscriberExportFilename(now = new Date()) {
  return `suppvis-beta-subscribers-${now.toISOString().slice(0, 10)}.xlsx`;
}

export function buildSubscriberExportWorkbook(input: {
  exportedPriorityCount?: number;
  priorityFilter: AdminSubscriberPriorityFilter;
  priorityLimit: number;
  search: string;
  sort: AdminSubscriberSort;
  subscribers: AdminBetaSubscriber[];
  totalPriorityCount: number;
  now?: Date;
}) {
  const now = input.now || new Date();
  const exportedPriorityCount =
    input.exportedPriorityCount ??
    input.subscribers.filter((subscriber) => subscriber.priorityBeta).length;
  const exportedStandardCount = input.subscribers.length - exportedPriorityCount;
  const subscriberWorksheet: XlsxWorksheet = {
    autoFilter: true,
    columnWidths: [14, 26, 18, 18, 32, 18, 18, 18, 22, 22, 18, 46, 22, 22],
    freezeHeader: true,
    name: "Beta Subscribers",
    rows: [
      [
        "Signup Order",
        "Full Name",
        "First Name",
        "Last Name",
        "Email",
        "Email Status",
        "Phone",
        "Text Status",
        "Priority Status",
        "Signup Date",
        "Source",
        "Admin Notes",
        "Created At",
        "Updated At",
      ].map((value) => ({ style: "header" as const, value })),
      ...input.subscribers.map((subscriber) => [
        subscriber.signupOrderNumber || null,
        subscriber.fullName,
        subscriber.firstName,
        subscriber.lastName,
        subscriber.email,
        adminExportStatusLabel(subscriber.emailStatus),
        formatPhoneForExport(subscriber.phoneE164 || subscriber.phoneRaw),
        adminExportStatusLabel(subscriber.smsStatus),
        subscriber.priorityBeta
          ? `Priority - Top ${input.priorityLimit}`
          : "Standard",
        dateCell(subscriber.createdAt),
        subscriber.sourcePage || "",
        { style: "wrap" as const, value: subscriber.adminNotes || "" },
        dateCell(subscriber.createdAt),
        dateCell(subscriber.updatedAt),
      ]),
    ],
  };
  const summaryWorksheet: XlsxWorksheet = {
    columnWidths: [30, 42],
    name: "Summary",
    rows: [
      [
        { style: "header" as const, value: "Field" },
        { style: "header" as const, value: "Value" },
      ],
      ["Export date", dateCell(now.toISOString())],
      ["Applied search", input.search.trim() || "None"],
      ["Applied filter", priorityFilterLabel(input.priorityFilter)],
      ["Applied sort", sortLabel(input.sort)],
      ["Total exported subscribers", input.subscribers.length],
      ["Priority subscribers in export", exportedPriorityCount],
      ["Standard subscribers in export", exportedStandardCount],
      ["Total priority subscribers", input.totalPriorityCount],
      ["Configured priority limit", input.priorityLimit],
    ],
  };

  return buildXlsxWorkbook([subscriberWorksheet, summaryWorksheet]);
}

function dateCell(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date;
}

function adminExportStatusLabel(value: string | null | undefined) {
  const text = (value || "unknown").trim();

  if (!text) {
    return "Unknown";
  }

  return text
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatPhoneForExport(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const local = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  return value || "";
}

function priorityFilterLabel(filter: AdminSubscriberPriorityFilter) {
  if (filter === "priority") {
    return "Priority only";
  }

  if (filter === "standard") {
    return "Standard only";
  }

  return "All subscribers";
}

function sortLabel(sort: AdminSubscriberSort) {
  if (sort === "signup_order_desc") {
    return "Signup order descending";
  }

  if (sort === "newest") {
    return "Newest first";
  }

  if (sort === "name_asc") {
    return "Name A-Z";
  }

  if (sort === "priority_first") {
    return "Priority first";
  }

  return "Signup order";
}
