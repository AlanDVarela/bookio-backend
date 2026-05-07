import nodemailer from 'nodemailer';
import { env } from '../config/env.config';

let _transporter: nodemailer.Transporter | undefined;

const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return _transporter;
};

export interface AppointmentEmailData {
  to: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  datetime: string;
  status: 'CONFIRMED' | 'CANCELLED';
  durationMinutes?: number;
  logoUrl?: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City',
  });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const shortId = (id: string) => `#${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const buildHtml = (data: AppointmentEmailData & { appointmentId: string }) => {
  const isConfirmed = data.status === 'CONFIRMED';
  const statusColor  = isConfirmed ? '#065F46' : '#991B1B';
  const statusBg     = isConfirmed ? '#D1FAE5' : '#FEE2E2';
  const statusIcon   = isConfirmed ? '✅' : '❌';
  const statusLabel  = isConfirmed ? 'Confirmada' : 'Cancelada';
  const accentColor  = '#3B82F6';

  const logoBlock = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="${data.businessName}"
            width="72" height="72"
            style="border-radius:50%;object-fit:cover;margin-bottom:12px;border:2px solid #e5e7eb;" /><br/>`
    : '';

  const durationBlock = data.durationMinutes
    ? `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="36" style="font-size:20px;">⏱</td>
            <td>
              <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Duración</div>
              <div style="font-size:15px;color:#111827;font-weight:500;">${data.durationMinutes} minutos</div>
            </td>
          </tr></table>
        </td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3F4F6;padding:32px 16px;">
<tr><td align="center">

  <!-- Card -->
  <table cellpadding="0" cellspacing="0" border="0" width="480"
         style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr><td align="center" style="padding:32px 24px 24px;border-bottom:1px solid #F3F4F6;">
      ${logoBlock}
      <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:6px;">${data.businessName}</div>
      <div style="font-size:15px;color:${accentColor};margin-bottom:16px;">${data.serviceName}</div>

      <!-- Status badge -->
      <div style="display:inline-block;background:${statusBg};color:${statusColor};
                  padding:6px 20px;border-radius:20px;font-size:14px;font-weight:600;">
        ${statusIcon}&nbsp;&nbsp;${statusLabel}
      </div>
    </td></tr>

    <!-- Detail rows -->
    <tr><td style="padding:8px 28px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">

        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" style="font-size:20px;">📅</td>
              <td>
                <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Fecha</div>
                <div style="font-size:15px;color:#111827;font-weight:500;">${capitalize(formatDate(data.datetime))}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" style="font-size:20px;">🕐</td>
              <td>
                <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Hora</div>
                <div style="font-size:15px;color:#111827;font-weight:500;">${formatTime(data.datetime)}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        ${durationBlock}

        <tr>
          <td style="padding:12px 0;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td width="36" style="font-size:20px;">👤</td>
              <td>
                <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Paciente / Cliente</div>
                <div style="font-size:15px;color:#111827;font-weight:500;">${data.clientName}</div>
              </td>
            </tr></table>
          </td>
        </tr>

      </table>
    </td></tr>

    <!-- Reference footer -->
    <tr><td style="padding:16px 28px 28px;">
      <div style="background:#F9FAFB;border-radius:12px;padding:14px 18px;text-align:center;">
        <div style="font-size:11px;color:#9CA3AF;margin-bottom:4px;">Código de referencia</div>
        <div style="font-size:16px;font-weight:700;color:#374151;letter-spacing:2px;">${shortId(data.appointmentId)}</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:6px;">Muéstralo al llegar</div>
      </div>
    </td></tr>

    <!-- Footer -->
    <tr><td align="center"
            style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #F3F4F6;
                   font-size:12px;color:#9CA3AF;">
      Bookio &mdash; Gestión de citas
      ${isConfirmed
        ? '<br/>Si necesitas cancelar, hazlo con al menos 2 horas de anticipación.'
        : '<br/>Puedes agendar una nueva cita en cualquier momento.'}
    </td></tr>

  </table>

</td></tr>
</table>
</body></html>`;
};

export const sendAppointmentEmail = async (
  data: AppointmentEmailData & { appointmentId: string },
) => {
  const isConfirmed = data.status === 'CONFIRMED';
  const subject = isConfirmed
    ? `Cita confirmada — ${data.businessName}`
    : `Cita cancelada — ${data.businessName}`;

  await getTransporter().sendMail({
    from: `Bookio <${env.SMTP_USER}>`,
    to: data.to,
    subject,
    html: buildHtml(data),
  });
};

export const verifyEmailConnection = async () => {
  await getTransporter().verify();
};
