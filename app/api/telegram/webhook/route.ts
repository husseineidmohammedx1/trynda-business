import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/notifications";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
      type?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  const expectedSecret =
    process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get(
    "x-telegram-bot-api-secret-token"
  );

  if (
    !expectedSecret ||
    receivedSecret !== expectedSecret
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const update =
      (await request.json()) as TelegramUpdate;
    const message = update.message;
    const chatId = String(message?.chat?.id ?? "");
    const text = String(message?.text ?? "").trim();

    if (
      !chatId ||
      message?.chat?.type !== "private"
    ) {
      return NextResponse.json({ ok: true });
    }

    if (
      text === "/start" ||
      text === "/start@tryndabusinessbot"
    ) {
      const linkedBooster =
        await prisma.user.findFirst({
          where: {
            role: "BOOSTER",
            active: true,
            telegramChatId: chatId,
          },
          select: { name: true },
        });

      await sendTelegramMessage(
        chatId,
        linkedBooster
          ? `Welcome back, ${linkedBooster.name}. Your Trynda notifications are active.`
          : "Welcome to Trynda Business. Please send the email address linked to your Booster account."
      );

      return NextResponse.json({ ok: true });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      await sendTelegramMessage(
        chatId,
        "Please send a valid Booster account email address."
      );
      return NextResponse.json({ ok: true });
    }

    const booster = await prisma.user.findFirst({
      where: {
        email: text.toLowerCase(),
        role: "BOOSTER",
        active: true,
      },
      select: { id: true, name: true },
    });

    if (!booster) {
      await sendTelegramMessage(
        chatId,
        "This email is not linked to an active Booster account. Contact the administrator."
      );
      return NextResponse.json({ ok: true });
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      }),
      prisma.user.update({
        where: { id: booster.id },
        data: { telegramChatId: chatId },
      }),
    ]);

    await sendTelegramMessage(
      chatId,
      `Your Telegram is now linked to ${booster.name}. You will receive your Trynda notifications here.`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}