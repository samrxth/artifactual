import React, {
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  FormEvent,
} from "react";
import { Send, Trash2, X, ArrowUpRight } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";

// Import ShadCN UI components
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import instructions from "@/lib/instructions";


import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

// @ts-ignore
const MarkdownRenderer = ({ children }) => {
  return (
    <div className="prose prose-lg mx-auto">
      <ReactMarkdown 
        children={children}
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeHighlight]}
      />
    </div>
  );
};


interface Message {
  role: "user" | "model";
  parts: Array<{ text: string }>;
  artifacts?: Artifact[];
}

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface Artifact {
  identifier: string;
  type: string;
  title: string;
  content: string;
  language?: string;
}

const convertMessageToGeminiMessage = (message: Message): GeminiMessage => {
  // Start with the text parts of the message
  const partsText = message.parts.map(part => part.text).join("\n");

  // If there are artifacts, convert them and append to the parts text
  let artifactsText = "";
  if (message.artifacts && message.artifacts.length > 0) {
    artifactsText = message.artifacts.map(artifact => {
      return `Title: ${artifact.title}\nContent: ${artifact.content}\nType: ${artifact.type}\nLanguage: ${artifact.language || "N/A"}`;
    }).join("\n\n");
  }

  // Combine the text parts and artifacts into the final GeminiMessage parts
  return {
    role: message.role, // Keep the same role as the original message
    parts: [
      {
        text: `${partsText}${artifactsText ? "\n\n" + artifactsText : ""}`
      }
    ]
  };
};

const convertMessagesToGeminiMessages = (messages: Message[]): GeminiMessage[] => {
  return messages.map(message => convertMessageToGeminiMessage(message));
};


const ArtifactDisplay: React.FC<{
  artifact: Artifact | null;
  onClose: () => void;
}> = ({ artifact, onClose }) => {
  if (!artifact) return null;

  const renderPreview = () => {
    switch (artifact.type) {
      case "text/markdown":
        return <MarkdownRenderer>{artifact.content}</MarkdownRenderer>;
      case "text/html":
        return <div dangerouslySetInnerHTML={{ __html: artifact.content }} />;
      case "image/svg+xml":
        return <div dangerouslySetInnerHTML={{ __html: artifact.content }} />;
      case "application/vnd.ant.mermaid":
        // Note: Mermaid rendering would require additional setup
        return <div>Mermaid diagram preview not yet implemented</div>;
      case "application/vnd.ant.react":
        // Note: React component rendering would require additional setup
        return <div>React component preview not yet implemented</div>;
      default:
        return <div>Preview not available for this artifact type</div>;
    }
  };

  return (
    <Card className="w-1/2 h-full fixed right-0 top-0 z-50 flex flex-col">
      <CardContent className="flex-1 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{artifact.title}</h2>
          <Button variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>
        <Tabs defaultValue="code">
            <TabsList>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          <TabsContent value="code">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <pre className="p-4 bg-gray-100 rounded">
                <code>{artifact.content}</code>
              </pre>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="preview">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {renderPreview()}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const MessageComponent: React.FC<{
  message: Message;
  onShowArtifact: (artifact: Artifact) => void;
}> = ({ message, onShowArtifact }) => {

  const renderMessageContent = () => {
    let content = message.parts[0].text;
    content = content.replace(
      /<antThinking>([\s\S]*?)<\/antThinking>/g,
      "*$1*",
    );
    content = content.replace(/<antArtifact[\s\S]*?<\/antArtifact>/g, '');
    return <MarkdownRenderer>{content}</MarkdownRenderer>;
  };

  return (
    <div
      className={`mb-4 ${message.role === "user" ? "text-right" : "text-left"}`}
    >
      <div
        className={`inline-block p-3 rounded ${message.role === "user" ? "bg-primary/10" : "bg-muted"}`}
        style={{ maxWidth: "90%" }}
      >
        {renderMessageContent()}
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mt-2">
            {message.artifacts.map((artifact, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="mr-2 mt-2"
                onClick={() => onShowArtifact(artifact)}
              >
                <ArrowUpRight className="h-4 w-4 mr-1" />
                {artifact.title}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PromptInterface: React.FC = () => {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const chatAreaRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem("apiKey");
    const storedModel = localStorage.getItem("model");
    const storedMessages = localStorage.getItem("chatHistory");

    if (storedApiKey) setApiKey(storedApiKey);
    if (storedModel) setModel(storedModel);
    if (storedMessages) setMessages(JSON.parse(storedMessages));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    localStorage.setItem("apiKey", newApiKey);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem("model", newModel);
  };

  const parseArtifacts = (text: string): Artifact[] => {
    const artifactRegex =
      /<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+(?:language="([^"]+)"\s+)?title="([^"]+)">([\s\S]*?)<\/antArtifact>/g;
    const artifacts: Artifact[] = [];
    let match;
    while ((match = artifactRegex.exec(text)) !== null) {
      artifacts.push({
        identifier: match[1],
        type: match[2],
        language: match[3],
        title: match[4],
        content: match[5].trim(),
      });
    }
    return artifacts;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !apiKey) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", parts: [{ text: input }] },
    ];
    setMessages(newMessages);
    setInput("");
    setIsThinking(true);
    setStreamingMessage("");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model });

      var geminiMessages = newMessages;
      geminiMessages = convertMessagesToGeminiMessages(geminiMessages);

      if (!chatRef.current) {
        chatRef.current = modelInstance.startChat({
          history: [
            { role: "user", parts: [{ text: instructions }] },
            ...geminiMessages,
          ],
        });
      }

      const result = await chatRef.current.sendMessageStream(input);

      let fullResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        setStreamingMessage((prevMessage) => prevMessage + chunkText);
      }

      const artifacts = parseArtifacts(fullResponse);
      setMessages([
        ...newMessages,
        { role: "model", parts: [{ text: fullResponse }], artifacts },
      ]);
      setStreamingMessage("");
    } catch (error) {
      console.error("Error fetching response:", error);
      setMessages([
        ...newMessages,
        {
          role: "model",
          parts: [{ text: "An error occurred while processing your request." + error }],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleShowArtifact = (artifact: Artifact) => {
    setCurrentArtifact(artifact);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-card shadow">
        <Input
          type="password"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="AIStudio API Key"
          className="w-36 md:w-48 lg:w-64 mr-4"
        />
        <div className="flex items-center">
          {!currentArtifact && (
            <div className="flex rounded-md">
              <Toggle
                pressed={model === "gemini-1.5-pro"}
                onPressedChange={() => handleModelChange("gemini-1.5-pro")}
                variant="outline"
              >
                <div
                  className={model === "gemini-1.5-pro" ? "text-green-600" : ""}
                >
                  gemini-1.5-pro
                </div>
              </Toggle>
              <div className="w-1"></div>
              <Toggle
                pressed={model === "gemini-1.5-flash"}
                onPressedChange={() => handleModelChange("gemini-1.5-flash")}
                variant="outline"
              >
                <div
                  className={
                    model === "gemini-1.5-flash" ? "text-green-600" : ""
                  }
                >
                  gemini-1.5-flash
                </div>
              </Toggle>
            </div>
          )}
          <Button onClick={handleClearChat} variant="outline" className="ml-4">
            <Trash2 className="h-5 w-5 mr-1" /> Clear
          </Button>
        </div>
      </div>
      <div className="flex-1 flex max-h-[92%]">
        <Card className="flex-1 mt-2 mx-4 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={chatAreaRef}>
            {messages.map((msg, index) => (
              <MessageComponent
                key={index}
                message={msg}
                onShowArtifact={handleShowArtifact}
              />
            ))}
            {streamingMessage && (
              <div className="mb-4 text-left">
                <div className="inline-block p-3 rounded bg-muted">
                  <MarkdownRenderer>{streamingMessage}</MarkdownRenderer>
                </div>
              </div>
            )}
            {isThinking && (
              <div className="mb-4 text-left">
                <div className="inline-block p-3 rounded bg-muted animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </ScrollArea>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex px-4 bg-card">
              <Textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="flex-1 mr-2 resize-none"
                style={{ maxHeight: "200px", overflowY: "auto" }}
              />
              <Button type="submit" disabled={isThinking}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
        {currentArtifact && (
          <ArtifactDisplay
            artifact={currentArtifact}
            onClose={() => setCurrentArtifact(null)}
          />
        )}
      </div>
    </div>
  );
};

export default PromptInterface;
