const nodemailer = require("nodemailer");

module.exports.send = async ({ to, title, message }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // send mail with defined transport object
        const info = await transporter.sendMail({
            from: '"LuxBubble" <noreply@luxbubble.com>',
            to: [].concat(to),
            subject: `${title}`,
            text: `${message}`.replace(/\<\/?br\/?\>/g, "\n").replace(/\<[^\>]+\>/g, ""),
            html: `${message}`,
        });
    } catch (error) {
        console.error("EmailService", error);
    }
};
