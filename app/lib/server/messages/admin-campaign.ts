export type AdminCampaignRenderInput = {
  appBaseUrl?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  heading: string;
  links?: AdminCampaignLink[];
  messageType?: string;
  subject: string;
  unsubscribeUrl?: string;
};

export type AdminCampaignRenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

export type AdminCampaignLinkStyle = "button" | "text";

export type AdminCampaignLinkPlacement =
  | { type: "before_body" }
  | { paragraphIndex: number; type: "after_paragraph" }
  | { type: "after_body" }
  | { type: "footer" };

export type AdminCampaignLink = {
  id: string;
  label: string;
  order: number;
  placement: AdminCampaignLinkPlacement;
  style: AdminCampaignLinkStyle;
  url: string;
};

const UNSUBSCRIBE_PLACEHOLDER =
  "Unsubscribe link will be inserted per recipient before a production send.";

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  beta_update: "BETA ANNOUNCEMENT",
  feedback_request: "FEEDBACK REQUEST",
  important_notice: "IMPORTANT NOTICE",
  product_update: "PRODUCT UPDATE",
  testflight_update: "TESTFLIGHT UPDATE",
};

export function adminCampaignMessageTypeDisplayLabel(messageType?: string) {
  return MESSAGE_TYPE_LABELS[messageType || ""] || "BETA ANNOUNCEMENT";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPublicAssetUrl(path: string, appBaseUrl?: string) {
  const baseUrl = (
    appBaseUrl ||
    process.env.APP_BASE_URL ||
    "https://www.suppvis.health"
  ).replace(/\/+$/, "");

  return new URL(path, baseUrl).toString();
}

function bodyParagraphs(body: string) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function paragraphHtml(copy: string) {
  const escapedLines = copy
    .split(/\n/)
    .map((line) => escapeHtml(line))
    .join("<br />");

  return `<p style="margin:0 0 18px 0;color:#9BAFBF;font-size:16px;line-height:1.65;">${escapedLines}</p>`;
}

function buttonHtml(href: string, label: string) {
  return `<p style="margin:0 0 18px 0;text-align:center;">
                  <a href="${escapeHtml(href)}" style="display:inline-block;border-radius:999px;background:#14B8A6;color:#0A0F14;text-decoration:none;font-size:16px;font-weight:800;padding:14px 24px;">${escapeHtml(label)}</a>
                </p>`;
}

function rawLinkHtml(href: string) {
  return `<p style="margin:0 0 22px 0;color:#9BAFBF;font-size:13px;line-height:1.55;word-break:break-all;text-align:center;">${escapeHtml(href)}</p>`;
}

function textLinkHtml(href: string, label: string) {
  return `<p style="margin:0 0 18px 0;text-align:center;color:#9BAFBF;font-size:16px;line-height:1.65;">
                  <a href="${escapeHtml(href)}" style="color:#14B8A6;text-decoration:underline;font-weight:800;">${escapeHtml(label)}</a>
                </p>`;
}

function adminFooterHtml(unsubscribeUrl?: string) {
  const unsubscribeMarkup = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#14B8A6;text-decoration:underline;">Unsubscribe</a>`
    : `<span style="color:#14B8A6;text-decoration:underline;">${escapeHtml(
        UNSUBSCRIBE_PLACEHOLDER,
      )}</span>`;

  return `<tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                You are receiving this because you joined the SuppVis beta.
                <br />
                ${unsubscribeMarkup}
              </td>
            </tr>`;
}

function normalizePlacement(value: unknown): AdminCampaignLinkPlacement {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type === "after_paragraph"
  ) {
    const paragraphIndex = Number(
      (value as { paragraphIndex?: unknown }).paragraphIndex,
    );

    if (Number.isInteger(paragraphIndex) && paragraphIndex > 0) {
      return { paragraphIndex, type: "after_paragraph" };
    }
  }

  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    ((value as { type?: unknown }).type === "before_body" ||
      (value as { type?: unknown }).type === "after_body" ||
      (value as { type?: unknown }).type === "footer")
  ) {
    return {
      type: (value as { type: "before_body" | "after_body" | "footer" }).type,
    };
  }

  return { type: "after_body" };
}

export function normalizeAdminCampaignLinks(input: {
  ctaLabel?: string;
  ctaUrl?: string;
  links?: unknown;
}): AdminCampaignLink[] {
  const rawLinks = Array.isArray(input.links) ? input.links : [];
  const normalized = rawLinks
    .map((rawLink, index): AdminCampaignLink | null => {
      if (!rawLink || typeof rawLink !== "object") {
        return null;
      }

      const link = rawLink as Record<string, unknown>;
      const label = String(link.label || "").trim();
      const url = String(link.url || "").trim();

      if (!label || !url) {
        return null;
      }

      const id = String(link.id || "").trim() || `link_${index + 1}`;
      const style = link.style === "text" ? "text" : "button";
      const order = Number(link.order);

      return {
        id,
        label,
        order: Number.isFinite(order) ? order : index + 1,
        placement: normalizePlacement(link.placement),
        style,
        url,
      };
    })
    .filter((link): link is AdminCampaignLink => Boolean(link))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  if (normalized.length) {
    return normalized.map((link, index) => ({
      ...link,
      order: index + 1,
    }));
  }

  const ctaLabel = input.ctaLabel?.trim();
  const ctaUrl = input.ctaUrl?.trim();

  if (!ctaLabel || !ctaUrl) {
    return [];
  }

  return [
    {
      id: "link_legacy_cta",
      label: ctaLabel,
      order: 1,
      placement: { type: "after_body" },
      style: "button",
      url: ctaUrl,
    },
  ];
}

export function firstAdminCampaignLinkFields(links: AdminCampaignLink[]) {
  const firstLink = links[0];

  return {
    ctaLabel: firstLink?.label || "",
    ctaUrl: firstLink?.url || "",
  };
}

export function adminCampaignLinksEqual(
  left: AdminCampaignLink[],
  right: AdminCampaignLink[],
) {
  return JSON.stringify(normalizeAdminCampaignLinks({ links: left })) ===
    JSON.stringify(normalizeAdminCampaignLinks({ links: right }));
}

function placementKey(
  placement: AdminCampaignLinkPlacement,
  paragraphCount: number,
) {
  if (
    placement.type === "after_paragraph" &&
    placement.paragraphIndex > 0 &&
    placement.paragraphIndex <= paragraphCount
  ) {
    return `after_paragraph:${placement.paragraphIndex}`;
  }

  if (placement.type === "before_body" || placement.type === "footer") {
    return placement.type;
  }

  return "after_body";
}

function groupedLinks(
  links: AdminCampaignLink[],
  paragraphCount: number,
): Record<string, AdminCampaignLink[]> {
  return links.reduce<Record<string, AdminCampaignLink[]>>((groups, link) => {
    const key = placementKey(link.placement, paragraphCount);
    groups[key] = groups[key] || [];
    groups[key].push(link);
    return groups;
  }, {});
}

function linkHtml(link: AdminCampaignLink) {
  if (link.style === "text") {
    return textLinkHtml(link.url, link.label);
  }

  return `${buttonHtml(link.url, link.label)}
                ${rawLinkHtml(link.url)}`;
}

function linkText(link: AdminCampaignLink) {
  return `${link.label}: ${link.url}`;
}

function renderLinksHtml(links?: AdminCampaignLink[]) {
  return (links || []).map(linkHtml).join("\n                ");
}

function renderLinksText(links?: AdminCampaignLink[]) {
  return (links || []).map(linkText);
}

function bodyHtmlWithLinks(body: string, links: AdminCampaignLink[]) {
  const paragraphs = bodyParagraphs(body);
  const groups = groupedLinks(links, paragraphs.length);
  const chunks = [
    renderLinksHtml(groups.before_body),
  ];

  paragraphs.forEach((paragraph, index) => {
    const paragraphNumber = index + 1;
    chunks.push(paragraphHtml(paragraph));
    chunks.push(renderLinksHtml(groups[`after_paragraph:${paragraphNumber}`]));
  });

  chunks.push(renderLinksHtml(groups.after_body));
  chunks.push(renderLinksHtml(groups.footer));

  return chunks.filter(Boolean).join("\n                ");
}

function bodyTextWithLinks(body: string, links: AdminCampaignLink[]) {
  const paragraphs = bodyParagraphs(body);
  const groups = groupedLinks(links, paragraphs.length);
  const chunks = [
    ...renderLinksText(groups.before_body),
  ];

  paragraphs.forEach((paragraph, index) => {
    const paragraphNumber = index + 1;
    chunks.push(paragraph);
    chunks.push(...renderLinksText(groups[`after_paragraph:${paragraphNumber}`]));
  });

  chunks.push(...renderLinksText(groups.after_body));
  chunks.push(...renderLinksText(groups.footer));

  return chunks.filter(Boolean).join("\n\n");
}

export function renderAdminCampaignEmail({
  appBaseUrl,
  body,
  ctaLabel,
  ctaUrl,
  heading,
  links,
  messageType,
  subject,
  unsubscribeUrl,
}: AdminCampaignRenderInput): AdminCampaignRenderedEmail {
  const brandIconUrl = escapeHtml(
    buildPublicAssetUrl("/email/suppvis-logo.png", appBaseUrl),
  );
  const displayLabel = adminCampaignMessageTypeDisplayLabel(messageType);
  const previewText = bodyParagraphs(body)[0]?.slice(0, 180) || heading;
  const resolvedLinks = normalizeAdminCampaignLinks({ ctaLabel, ctaUrl, links });
  const bodyHtml = bodyHtmlWithLinks(body, resolvedLinks);
  const textParts = [
    heading,
    "",
    bodyTextWithLinks(body, resolvedLinks),
    "",
    "You are receiving this because you joined the SuppVis beta.",
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : UNSUBSCRIBE_PLACEHOLDER,
  ].filter((part) => part !== undefined);

  return {
    subject,
    text: textParts.join("\n"),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#0A0F14;color:#F0F4F8;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(previewText)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0F14;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;text-align:left;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="text-align:left;vertical-align:middle;">
                      <div style="font-size:24px;line-height:1;font-weight:800;letter-spacing:0;color:#F0F4F8;">SuppVis</div>
                      <div style="padding-top:7px;color:#14B8A6;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(displayLabel)}</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="display:inline-block;width:42px;height:42px;border:1px solid rgba(20,184,166,0.42);border-radius:14px;background:rgba(20,184,166,0.10);overflow:hidden;">
                        <img src="${brandIconUrl}" width="42" height="42" alt="SuppVis" style="display:block;width:42px;height:42px;border:0;outline:none;text-decoration:none;" />
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0D1117;border:1px solid rgba(20,184,166,0.22);border-radius:18px;padding:34px 28px;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
                <p style="margin:0 0 14px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(displayLabel)}</p>
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            ${adminFooterHtml(unsubscribeUrl)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
