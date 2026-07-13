export type AdminCampaignRenderInput = {
  appBaseUrl?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  heading: string;
  subject: string;
};

export type AdminCampaignRenderedEmail = {
  html: string;
  subject: string;
  text: string;
};

const UNSUBSCRIBE_PLACEHOLDER =
  "Unsubscribe link will be inserted per recipient before a production send.";

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

function adminFooterHtml() {
  return `<tr>
              <td style="padding:18px 8px 0 8px;text-align:center;color:#5A7089;font-size:12px;line-height:1.6;">
                You are receiving this because you joined the SuppVis beta.
                <br />
                <span style="color:#14B8A6;text-decoration:underline;">${escapeHtml(
                  UNSUBSCRIBE_PLACEHOLDER,
                )}</span>
              </td>
            </tr>`;
}

export function renderAdminCampaignEmail({
  appBaseUrl,
  body,
  ctaLabel,
  ctaUrl,
  heading,
  subject,
}: AdminCampaignRenderInput): AdminCampaignRenderedEmail {
  const brandIconUrl = escapeHtml(buildPublicAssetUrl("/favicon.svg", appBaseUrl));
  const previewText = bodyParagraphs(body)[0]?.slice(0, 180) || heading;
  const bodyHtml = [
    ...bodyParagraphs(body).map(paragraphHtml),
    ctaLabel && ctaUrl ? buttonHtml(ctaUrl, ctaLabel) : "",
    ctaUrl ? rawLinkHtml(ctaUrl) : "",
  ]
    .filter(Boolean)
    .join("\n                ");
  const textParts = [
    heading,
    "",
    body.trim(),
    "",
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : "",
    "",
    "You are receiving this because you joined the SuppVis beta.",
    UNSUBSCRIBE_PLACEHOLDER,
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
                      <div style="padding-top:7px;color:#14B8A6;font-size:11px;line-height:1;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Beta update</div>
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
                <p style="margin:0 0 14px 0;color:#14B8A6;font-size:12px;line-height:1;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Beta update</p>
                <h1 style="margin:0 0 22px 0;color:#F0F4F8;font-size:28px;line-height:1.15;font-weight:800;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            ${adminFooterHtml()}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
