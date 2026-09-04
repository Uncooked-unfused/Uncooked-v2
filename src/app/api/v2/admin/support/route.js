import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSupportTicketNotification } from "@/lib/email/service";
import { requireSuperAdmin, enforceMutationGuards } from "@/server/http/guards";
import { validateSupportStatusTransition } from "@/server/support/ticketStatus";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) return auth.error;

    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[Admin Support API] Error fetching tickets:", error);
    return NextResponse.json({ error: "Failed to fetch support tickets" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) return auth.error;
    const user = auth.user;

    const blocked = await enforceMutationGuards(req, {
      rateKey: "rl_admin_support",
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (blocked) return blocked;

    const { ticketId, message, status } = await req.json();

    if (!ticketId || (!message && !status)) {
      return NextResponse.json({ error: "Ticket ID and message or status update required" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
    }

    let nextStatus = null;
    if (status) {
      const transition = validateSupportStatusTransition(ticket.status, status);
      if (!transition.ok) {
        return NextResponse.json(
          { error: transition.error, code: "INVALID_STATUS_TRANSITION" },
          { status: 400 }
        );
      }
      nextStatus = transition.status;
    }

    if (message) {
      await prisma.ticketMessage.create({
        data: {
          ticketId,
          senderId: user.id,
          senderType: "STAFF",
          content: String(message).slice(0, 8000),
        },
      });

      if (ticket.user?.email) {
        await sendSupportTicketNotification({
          to: ticket.user.email,
          ticketId: ticket.id,
          subject: ticket.subject,
          category: ticket.category,
          message,
          senderName: user.name || user.fullName || "Support Team",
          isReply: true,
        });
      }
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        updatedAt: new Date(),
      },
      include: {
        user: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("[Admin Support API] Error processing support action:", error);
    return NextResponse.json({ error: "Failed to process support response" }, { status: 500 });
  }
}
