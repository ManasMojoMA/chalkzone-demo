"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, Bot, User } from "lucide-react";
import { chatWithAI } from "../knowledge-base/actions";
import { toast } from "sonner";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      content: "Hello! I'm the ChalkZone AI Assistant. Ask me anything about the campus, academic policies, or resources.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userQuestion = input.trim();
    setInput("");
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userQuestion,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("question", userQuestion);
      
      const result = await chatWithAI(formData);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      if (result.response) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: result.response,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to connect to the AI assistant.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">AI Assistant</h2>
        <p className="text-muted-foreground">
          Ask questions about university policies, events, and resources.
        </p>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden">
        <CardHeader className="border-b px-6 py-4">
          <CardTitle className="text-lg flex items-center">
            <Bot className="mr-2 h-5 w-5 text-primary" />
            ChalkZone Assistant
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-6" ref={scrollRef}>
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="w-8 h-8 border">
                    {message.role === "ai" ? (
                      <>
                        <AvatarFallback className="bg-primary/10">AI</AvatarFallback>
                        <Bot className="h-5 w-5 text-primary absolute top-1.5 left-1.5" />
                      </>
                    ) : (
                      <>
                        <AvatarFallback className="bg-muted">U</AvatarFallback>
                        <User className="h-5 w-5 text-muted-foreground absolute top-1.5 left-1.5" />
                      </>
                    )}
                  </Avatar>
                  <div
                    className={`rounded-lg px-4 py-3 max-w-[80%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start gap-4">
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback className="bg-primary/10">AI</AvatarFallback>
                    <Bot className="h-5 w-5 text-primary absolute top-1.5 left-1.5" />
                  </Avatar>
                  <div className="rounded-lg px-4 py-3 bg-muted text-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        
        <div className="p-4 border-t bg-background">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 max-w-4xl mx-auto w-full"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1"
              disabled={isLoading}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
