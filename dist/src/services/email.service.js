"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailConnection = exports.sendAppointmentEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_config_1 = require("../config/env.config");
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: env_config_1.env.SMTP_USER,
        pass: env_config_1.env.SMTP_PASS,
    },
});
const formatDatetime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City',
    });
};
const sendAppointmentEmail = async (data) => {
    const isConfirmed = data.status === 'CONFIRMED';
    const subject = isConfirmed
        ? `Cita confirmada — ${data.businessName}`
        : `Cita cancelada — ${data.businessName}`;
    const html = isConfirmed
        ? `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#2563eb;">✅ Tu cita está confirmada</h2>
        <p>Hola <strong>${data.clientName}</strong>,</p>
        <p>Tu cita ha sido confirmada con los siguientes detalles:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr style="background:#f1f5f9;">
            <td style="padding:10px 14px;font-weight:bold;">Negocio</td>
            <td style="padding:10px 14px;">${data.businessName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;">Servicio</td>
            <td style="padding:10px 14px;">${data.serviceName}</td>
          </tr>
          <tr style="background:#f1f5f9;">
            <td style="padding:10px 14px;font-weight:bold;">Fecha y hora</td>
            <td style="padding:10px 14px;">${formatDatetime(data.datetime)}</td>
          </tr>
        </table>
        <p style="color:#64748b;font-size:13px;">
          Si necesitas cancelar, hazlo con al menos 2 horas de anticipación.
        </p>
        <p style="color:#64748b;font-size:13px;">— El equipo de Bookio</p>
      </div>
    `
        : `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#dc2626;">❌ Tu cita fue cancelada</h2>
        <p>Hola <strong>${data.clientName}</strong>,</p>
        <p>Tu cita en <strong>${data.businessName}</strong> para el servicio
           <strong>${data.serviceName}</strong> el <strong>${formatDatetime(data.datetime)}</strong>
           ha sido cancelada.</p>
        <p>Puedes agendar una nueva cita en cualquier momento.</p>
        <p style="color:#64748b;font-size:13px;">— El equipo de Bookio</p>
      </div>
    `;
    await transporter.sendMail({
        from: `Bookio <${env_config_1.env.SMTP_USER}>`,
        to: data.to,
        subject,
        html,
    });
};
exports.sendAppointmentEmail = sendAppointmentEmail;
const verifyEmailConnection = async () => {
    await transporter.verify();
};
exports.verifyEmailConnection = verifyEmailConnection;
