import * as admin from "firebase-admin";
import { ConversationTurn } from "./conversationService";

interface FirestoreChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: string[];
  metadata?: Record<string, unknown>;
  imagePrompt?: string;
}

interface FirestoreChatDocument {
  chatId: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  lastMessageTimestamp?: number;
  pendingPersistence?: boolean;
  archived?: boolean;
  messages: FirestoreChatMessage[];
  lastPersistedAt?: number;
}

class FirestoreChatService {
  private readonly firestore: admin.firestore.Firestore | null;
  private readonly maxMessagesPerChat = 40;

  constructor() {
    try {
      if (!admin.apps.length) {
        const serviceAccount = require("../serviceAccountKey.json");
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
        });
        console.log("🔥 Firebase Admin initialized (FireStore Chat Service)");
      }
      this.firestore = admin.firestore();
    } catch (error) {
      console.error("❌ Failed to initialize Firestore:", error);
      this.firestore = null;
    }
  }

  private getChatCollection(userId: string) {
    if (!this.firestore) {
      throw new Error("Firestore is not initialized");
    }
    return this.firestore
      .collection("users")
      .doc(userId)
      .collection("activeChats");
  }

  async saveTurn(turn: ConversationTurn): Promise<void> {
    if (!turn.chatId) {
      // Some legacy flows might not send chatId; skip to avoid polluting Firestore.
      console.warn("⚠️ FirestoreChatService.saveTurn skipped – missing chatId");
      return;
    }

    try {
      const chatRef = this.getChatCollection(turn.userId).doc(turn.chatId);
      await this.firestore!.runTransaction(async (tx) => {
        const snapshot = await tx.get(chatRef);
        const existing = snapshot.exists
          ? (snapshot.data() as FirestoreChatDocument)
          : undefined;

        const timestamp = turn.timestamp ?? Date.now();
        const userMessage: FirestoreChatMessage = {
          id: `${turn.id}-user`,
          role: "user",
          content: turn.userPrompt,
          timestamp,
        };

        const assistantMessage: FirestoreChatMessage = {
          id: `${turn.id}-assistant`,
          role: "assistant",
          content: turn.aiResponse,
          timestamp,
        };

        if (turn.hasImage && turn.imageUrl) {
          assistantMessage.attachments = [turn.imageUrl];
        }
        if (turn.imagePrompt) {
          assistantMessage.imagePrompt = turn.imagePrompt;
        }

        const messages = existing?.messages ? [...existing.messages] : [];
        messages.push(userMessage, assistantMessage);
        while (messages.length > this.maxMessagesPerChat) {
          messages.shift();
        }

        const titleSource = existing?.title || turn.userPrompt;
        const title = titleSource
          ? titleSource.substring(0, 80) + (titleSource.length > 80 ? "…" : "")
          : "New Chat";

        const doc: Partial<FirestoreChatDocument> = {
          chatId: turn.chatId,
          userId: turn.userId,
          title,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
          lastMessageTimestamp: timestamp,
          lastUserMessage: turn.userPrompt,
          lastAssistantMessage: turn.aiResponse,
          messageCount: (existing?.messageCount || 0) + 2,
          pendingPersistence: true,
          messages,
        };

        tx.set(chatRef, doc, { merge: true });
      });
    } catch (error) {
      console.error("❌ FirestoreChatService.saveTurn failed:", error);
    }
  }

  async listActiveChats(userId: string): Promise<any[]> {
    try {
      const snapshot = await this.getChatCollection(userId)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data() as FirestoreChatDocument;
        const messages = (data.messages || []).map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString(),
          attachments: msg.attachments,
          imagePrompt: msg.imagePrompt,
        }));

        return {
          id: data.chatId || doc.id,
          title: data.title || "New Chat",
          timestamp: new Date(data.updatedAt || Date.now()).toISOString(),
          userId,
          messages,
          source: "firestore",
          metadata: {
            pendingPersistence: data.pendingPersistence ?? false,
            messageCount: data.messageCount ?? messages.length,
            lastPersistedAt: data.lastPersistedAt ?? null,
          },
        };
      });
    } catch (error) {
      console.error("❌ FirestoreChatService.listActiveChats failed:", error);
      return [];
    }
  }

  async markChatPersisted(userId: string, chatId: string): Promise<void> {
    try {
      const chatRef = this.getChatCollection(userId).doc(chatId);
      await chatRef.set(
        {
          pendingPersistence: false,
          lastPersistedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("❌ FirestoreChatService.markChatPersisted failed:", error);
    }
  }

  async archiveChat(
    userId: string,
    chatId: string,
    archived: boolean
  ): Promise<void> {
    try {
      const chatRef = this.getChatCollection(userId).doc(chatId);
      await chatRef.set(
        {
          archived,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("❌ FirestoreChatService.archiveChat failed:", error);
    }
  }

  async deleteChat(userId: string, chatId: string): Promise<void> {
    try {
      await this.getChatCollection(userId).doc(chatId).delete();
    } catch (error) {
      console.error("❌ FirestoreChatService.deleteChat failed:", error);
    }
  }
}

export const firestoreChatService = new FirestoreChatService();
