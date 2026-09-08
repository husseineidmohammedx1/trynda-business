import nodemailer from "nodemailer";

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER or GMAIL_APP_PASSWORD is missing from .env"
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  await transporter.verify();

  await transporter.sendMail({
    from: `"Trynda Business" <${user}>`,
    to: user,
    subject: "Trynda Business Test Email",
    text: "Gmail SMTP is working correctly.",
  });

  console.log(`Test email sent successfully to ${user}`);
}

main()
  .catch((error) => {
    console.error("Email test failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });