import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";

const ADMIN_EMAIL =
  "hessaneidmohammedx1@gmail.com";

const CODE_EXPIRES_MINUTES = 10;

function hashCode(code: string) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const email = String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          error: "Email is required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "===================================="
    );
    console.log(
      "PASSWORD RESET REQUEST"
    );
    console.log(
      "Requested email:",
      email
    );
    console.log(
      "Primary admin:",
      ADMIN_EMAIL
    );
    console.log(
      "===================================="
    );

    // Only the primary admin is allowed.
    if (email !== ADMIN_EMAIL) {
      console.log(
        "Reset rejected: email is not primary admin."
      );

      return NextResponse.json(
        {
          error:
            "Password reset is only available for the primary admin account.",
        },
        {
          status: 403,
        }
      );
    }

    // Find admin account.
    const admin =
      await prisma.user.findUnique({
        where: {
          email: ADMIN_EMAIL,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      });

    if (!admin) {
      console.error(
        "Reset failed: admin account not found."
      );

      return NextResponse.json(
        {
          error:
            "Primary admin account was not found.",
        },
        {
          status: 404,
        }
      );
    }

    if (admin.role !== "ADMIN") {
      console.error(
        "Reset failed: account is not ADMIN."
      );

      return NextResponse.json(
        {
          error:
            "This account is not an admin account.",
        },
        {
          status: 403,
        }
      );
    }

    if (!admin.active) {
      console.error(
        "Reset failed: admin account is inactive."
      );

      return NextResponse.json(
        {
          error:
            "Admin account is inactive.",
        },
        {
          status: 403,
        }
      );
    }

    console.log(
      "Admin account found:",
      admin.email
    );

    // Remove old reset requests.
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: admin.id,
      },
    });

    // Generate 6 digit code.
    const code =
      crypto
        .randomInt(
          100000,
          1000000
        )
        .toString();

    const tokenHash =
      hashCode(code);

    const expiresAt =
      new Date(
        Date.now() +
          CODE_EXPIRES_MINUTES *
            60 *
            1000
      );

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: admin.id,
        expiresAt,
      },
    });

    console.log(
      "Reset code generated:"
    );

    console.log(
      code
    );

    const gmailUser =
      process.env.GMAIL_USER;

    const gmailPassword =
      process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser) {
      throw new Error(
        "GMAIL_USER is missing from .env"
      );
    }

    if (!gmailPassword) {
      throw new Error(
        "GMAIL_APP_PASSWORD is missing from .env"
      );
    }

    console.log(
      "Gmail sender:",
      gmailUser
    );

    const transporter =
      nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
      });

    // Verify Gmail connection.
    await transporter.verify();

    console.log(
      "Gmail SMTP verification: OK"
    );

    const info =
      await transporter.sendMail({
        from:
          `"Trynda Business" <${gmailUser}>`,

        to: ADMIN_EMAIL,

        subject:
          "Trynda Business - Admin Reset Code",

        text:
          `Trynda Business\n\n` +
          `Your admin password reset code is:\n\n` +
          `${code}\n\n` +
          `The code expires in ${CODE_EXPIRES_MINUTES} minutes.\n\n` +
          `If you did not request this code, ignore this email.`,

        html: `
          <!DOCTYPE html>
          <html>
            <body style="
              margin:0;
              padding:0;
              background:#0b1120;
              font-family:Arial,sans-serif;
            ">
              <div style="
                max-width:560px;
                margin:40px auto;
                padding:32px;
                background:#10172a;
                color:#eef2ff;
                border-radius:18px;
              ">

                <h2 style="
                  margin:0 0 8px;
                  font-size:24px;
                ">
                  Trynda Business
                </h2>

                <p style="
                  color:#8995ab;
                  margin-top:0;
                ">
                  Administrator Password Reset
                </p>

                <p>
                  Hello ${admin.name},
                </p>

                <p style="
                  color:#cbd5e1;
                  line-height:1.6;
                ">
                  Use the following verification
                  code to reset your administrator
                  password:
                </p>

                <div style="
                  margin:28px 0;
                  padding:22px;
                  text-align:center;
                  background:#0b1120;
                  border:1px solid #29344d;
                  border-radius:14px;
                ">

                  <div style="
                    font-size:10px;
                    color:#8995ab;
                    letter-spacing:3px;
                    margin-bottom:10px;
                  ">
                    RESET CODE
                  </div>

                  <div style="
                    font-size:34px;
                    font-weight:800;
                    letter-spacing:10px;
                    color:#a89fff;
                  ">
                    ${code}
                  </div>

                </div>

                <p style="
                  color:#8995ab;
                  font-size:12px;
                  line-height:1.6;
                ">
                  This code expires in
                  ${CODE_EXPIRES_MINUTES}
                  minutes.
                </p>

                <p style="
                  color:#8995ab;
                  font-size:12px;
                ">
                  If you did not request this,
                  ignore this email.
                </p>

              </div>
            </body>
          </html>
        `,
      });

    console.log(
      "===================================="
    );

    console.log(
      "EMAIL SENT"
    );

    console.log(
      "Message ID:",
      info.messageId
    );

    console.log(
      "Accepted:",
      info.accepted
    );

    console.log(
      "Rejected:",
      info.rejected
    );

    console.log(
      "Response:",
      info.response
    );

    console.log(
      "===================================="
    );

    if (
      !info.accepted ||
      info.accepted.length === 0
    ) {
      throw new Error(
        "Gmail did not accept the reset email."
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Reset code sent successfully.",
    });
  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "FORGOT PASSWORD ERROR"
    );

    console.error(
      error
    );

    console.error(
      "===================================="
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send reset code.",
      },
      {
        status: 500,
      }
    );
  }
}