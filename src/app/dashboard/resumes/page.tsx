"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { getResumes, createResume, deleteResume } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ResumesPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newResumeTitle, setNewResumeTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.role !== "STUDENT") {
      setLoading(false);
      return;
    }

    if (user?.id) {
      loadResumes();
    }
  }, [user]);

  async function loadResumes() {
    setLoading(true);
    try {
      if (user?.id) {
        const data = await getResumes();
        setResumes(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateResume() {
    if (!user?.id || !newResumeTitle.trim()) return;
    
    setIsCreating(true);
    try {
      const newResume = await createResume(newResumeTitle.trim());
      setResumes([newResume, ...resumes]);
      setNewResumeTitle("");
      setIsDialogOpen(false);
      router.push(`/dashboard/resumes/${newResume.id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create resume.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    
    try {
      await deleteResume(id);
      setResumes(resumes.filter((r) => r.id !== id));
    } catch (error) {
      console.error(error);
      alert("Failed to delete resume.");
    }
  }

  if (user?.role !== "STUDENT") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Only students can access the Resume Builder.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">My Resumes</h1>
          <p className="text-muted-foreground mt-1">
            Build and manage your professional resumes
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Resume
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Resume</DialogTitle>
              <DialogDescription>
                Give your resume a name to get started.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="e.g. Software Engineer Resume"
                value={newResumeTitle}
                onChange={(e) => setNewResumeTitle(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateResume} disabled={isCreating || !newResumeTitle.trim()}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {resumes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No resumes yet</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Create your first resume to start applying for jobs and internships. Our builder will guide you through the process.
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Resume
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resumes.map((resume) => (
            <Card key={resume.id} className="flex flex-col transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader>
                <CardTitle className="line-clamp-1">{resume.title}</CardTitle>
                <CardDescription>
                  Last updated: {new Date(resume.updatedAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="aspect-[1/1.414] bg-muted/30 rounded-md border flex items-center justify-center text-muted-foreground/50 text-sm">
                  <FileText className="h-12 w-12 opacity-20" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-2 border-t pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full" 
                  onClick={() => router.push(`/dashboard/resumes/${resume.id}`)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => handleDelete(resume.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
