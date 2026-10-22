// The "join the WhatsApp group" email sent to each participant once their
// ticket is issued. Same wording as the WhatsApp template on the admin
// Messages page; {{name}} becomes the recipient's first name and the
// button links to the event's whatsappGroupUrl.
export const WHATSAPP_INVITE_EMAIL = {
  subject: 'Join the IFY Summit WhatsApp group',
  bodyHtml:
    '<p>Assalamu alaikum {{name}},</p>' +
    "<p>Thank you for registering for the <strong>Islamic Finance Youth Summit</strong>! We've created a WhatsApp group for participants, where we'll share important updates, the schedule, and reminders ahead of the event.</p>" +
    '<p>Tap the button below to join.</p>' +
    '<p>See you there!<br>The IFY Summit Team</p>',
  ctaLabel: 'Join the WhatsApp group',
};
