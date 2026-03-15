const HERENCIA_LOGO_URL = "https://www.deherencia.com/images/logoHerencia.png";
const HERENCIA_SITE_URL = "https://www.deherencia.com";

export function appendHerenciaSignature(html: string): string {
  const body = String(html ?? "").trim();
  return `
    ${body}
    <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
    <p style="margin:0 0 6px 0">
      <img src="${HERENCIA_LOGO_URL}" alt="Herencia" width="72" height="72" style="display:block;border:0;outline:none;text-decoration:none;" />
    </p>
    <p style="margin:0;font-size:12px;color:#444">
      <a href="${HERENCIA_SITE_URL}" style="color:#444;text-decoration:none;">www.deherencia.com</a>
    </p>
  `;
}
