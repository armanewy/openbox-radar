import 'server-only';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendAlertEmail(to: string, payload: {
  title: string; priceCents: number; conditionLabel: string; url: string; store: string;
  reason: 'new' | 'price_drop';
}) {
  const price = `$${(payload.priceCents / 100).toFixed(2)}`;
  await resend.emails.send({
    from: 'Open-Box Radar <alerts@openboxradar.com>',
    to,
    subject: `${payload.reason === 'price_drop' ? 'Price drop' : 'New'}: ${payload.title} — ${price} @ ${payload.store}`,
    html: `<p><b>${payload.title}</b></p>
           <p>${price} — ${payload.conditionLabel} — ${payload.store}</p>
           <p><a href="${payload.url}">Open retailer page</a></p>
           <p>You received this based on your watch settings.</p>`,
  });
}
