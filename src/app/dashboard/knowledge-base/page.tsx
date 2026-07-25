"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

import { createResourceDocument, getResourceDocuments } from "./actions";
import { Loader2, Plus, FileText, FileUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// Since I don't know if use-toast exists, I'll use Sonner or basic alert if needed, wait I saw sonner.tsx in ui components!
import { toast } from "sonner";

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    setLoading(true);
    const result = await getResourceDocuments();
    if (result.documents) {
      setDocuments(result.documents);
    } else {
      toast.error(result.error || "Failed to load documents");
    }
    setLoading(false);
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    const result = await createResourceDocument(formData);
    
    if (result.success) {
      toast.success("Document added successfully");
      // Reset form manually or handled by form submission naturally
      fetchDocuments();
    } else {
      toast.error(result.error || "Failed to add document");
    }
    setSubmitting(false);
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Knowledge Base</h2>
      </div>
      <p className="text-muted-foreground">
        Manage resources and documents used by the AI Assistant.
      </p>

      <Tabs defaultValue="add" className="space-y-4">
        <TabsList>
          <TabsTrigger value="add">Add Document</TabsTrigger>
          <TabsTrigger value="list">View Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Resource</CardTitle>
              <CardDescription>
                Write or paste text content to be stored in the knowledge base.
              </CardDescription>
            </CardHeader>
            <form action={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Title
                  </label>
                  <Input 
                    id="title" 
                    name="title" 
                    placeholder="e.g. 2026 Academic Calendar" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="content" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Content
                  </label>
                  <Textarea 
                    id="content" 
                    name="content" 
                    placeholder="Paste the document content here..." 
                    className="min-h-[200px]" 
                    required 
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add to Knowledge Base
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Documents</CardTitle>
              <CardDescription>
                Existing documents available to the AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
                  <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">No documents found</p>
                  <p className="text-sm text-muted-foreground">Add a document to get started.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <h4 className="font-medium">{doc.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            Added on {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
