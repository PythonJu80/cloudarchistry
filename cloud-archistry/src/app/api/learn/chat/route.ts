import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - Fetch user's chat history (all chats or specific chat)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("id");

    if (chatId) {
      // Get specific chat
      const chat = await prisma.learningChat.findFirst({
        where: {
          id: chatId,
          profileId: session.user.academyProfileId,
        },
      });

      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      return NextResponse.json(chat);
    }

    // Get all chats for user (most recent first)
    const chats = await prisma.learningChat.findMany({
      where: {
        profileId: session.user.academyProfileId,
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      select: {
        id: true,
        title: true,
        keywords: true,
        questionsAsked: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST - Create new chat or update existing
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, messages, keywords, topicsDiscussed } = body;

    // Generate title from first user message
    const firstUserMessage = messages?.find((m: { role: string }) => m.role === "user");
    const title = firstUserMessage 
      ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "")
      : "New Chat";

    const questionsAsked = messages?.filter((m: { role: string }) => m.role === "user").length || 0;

    if (chatId) {
      // Update existing chat
      const chat = await prisma.learningChat.update({
        where: {
          id: chatId,
          profileId: session.user.academyProfileId,
        },
        data: {
          messages: messages || [],
          keywords: keywords || [],
          topicsDiscussed: topicsDiscussed || [],
          questionsAsked,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return NextResponse.json(chat);
    }

    // Create new chat
    const chat = await prisma.learningChat.create({
      data: {
        profileId: session.user.academyProfileId,
        title,
        messages: messages || [],
        keywords: keywords || [],
        topicsDiscussed: topicsDiscussed || [],
        questionsAsked,
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error saving chat:", error);
    return NextResponse.json(
      { error: "Failed to save chat" },
      { status: 500 }
    );
  }
}

// PATCH - Rename a chat
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, title } = body;

    if (!chatId || !title) {
      return NextResponse.json({ error: "Chat ID and title required" }, { status: 400 });
    }

    const chat = await prisma.learningChat.update({
      where: {
        id: chatId,
        profileId: session.user.academyProfileId,
      },
      data: {
        title: title.slice(0, 100), // Limit title length
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error renaming chat:", error);
    return NextResponse.json(
      { error: "Failed to rename chat" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a chat
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.academyProfileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("id");

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
    }

    await prisma.learningChat.delete({
      where: {
        id: chatId,
        profileId: session.user.academyProfileId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
