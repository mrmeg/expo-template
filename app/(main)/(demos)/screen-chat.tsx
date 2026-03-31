import React, { useState, useCallback, useRef } from "react";
import { ChatScreen, type ChatMessage, type MessageStatus } from "@/client/screens/ChatScreen";

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    text: "Hey! Are we still on for the design review this afternoon?",
    timestamp: today(9, 5),
    isMine: false,
    status: "read",
  },
  {
    id: "2",
    text: "Yes, 3pm works for me. I'll share the Figma link beforehand.",
    timestamp: today(9, 7),
    isMine: true,
    status: "read",
  },
  {
    id: "3",
    text: "Perfect. I've updated the component library with the new tokens.",
    timestamp: today(9, 12),
    isMine: false,
    status: "read",
  },
  {
    id: "4",
    text: "Nice! Did you get the spacing issue on the cards sorted out?",
    timestamp: today(9, 14),
    isMine: true,
    status: "read",
  },
  {
    id: "5",
    text: "Yep, radiusMd is 6 now and cards use radiusLg at 8. Looks way cleaner.",
    timestamp: today(9, 16),
    isMine: false,
    status: "delivered",
  },
  {
    id: "6",
    text: "Awesome. I also pushed the dark mode fixes for the toggle components.",
    timestamp: today(10, 30),
    isMine: true,
    status: "delivered",
  },
  {
    id: "7",
    text: "Saw that! The accent color on the active tabs is much better now.",
    timestamp: today(10, 33),
    isMine: false,
    status: "delivered",
  },
  {
    id: "8",
    text: "One thing - the shadow on web still returns an empty object right?",
    timestamp: today(11, 45),
    isMine: false,
    status: "sent",
  },
  {
    id: "9",
    text: "Correct, boxShadow crashes RN Web so we skip it there.",
    timestamp: today(11, 47),
    isMine: true,
    status: "sent",
  },
  {
    id: "10",
    text: "Makes sense. I'll add a note in the design docs.",
    timestamp: today(11, 48),
    isMine: false,
    status: "sent",
  },
  {
    id: "11",
    text: "Sounds good. Want to grab lunch before the review?",
    timestamp: today(12, 15),
    isMine: true,
    status: "delivered",
  },
  {
    id: "12",
    text: "Sure! Meet at the lobby at 12:30?",
    timestamp: today(12, 16),
    isMine: false,
    status: "sending",
  },
];

export default function ScreenChatDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = useCallback((text: string) => {
    const newId = makeId();
    const newMessage: ChatMessage = {
      id: newId,
      text,
      timestamp: new Date(),
      isMine: true,
      status: "sending",
    };

    setMessages((prev) => [...prev, newMessage]);

    // Update status to "sent" after 1 second
    statusTimer.current = setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newId ? { ...m, status: "sent" as MessageStatus } : m))
      );
    }, 1000);

    // Simulate partner typing for 2 seconds
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  }, []);

  return (
    <ChatScreen
      messages={messages}
      onSend={handleSend}
      isTyping={isTyping}
      placeholder="Type a message..."
    />
  );
}
