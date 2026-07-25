"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getActiveAppraisalCycle,
  createMockAppraisalCycle,
  getFacultyProfile,
  getFacultySubmission,
  submitAppraisal,
  getAllSubmissions,
  evaluateSubmission
} from "./actions";
import { Loader2, Plus, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { FacultySubmissionWithRelations } from "@/lib/types";

export default function AppraisalsPage() {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [facultyProfile, setFacultyProfile] = useState<any>(null);
  
  // Faculty State
  const [submission, setSubmission] = useState<any>(null);
  const [formData, setFormData] = useState({
    teachingPoints: "",
    researchPoints: "",
    adminPoints: "",
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manager State
  const [allSubmissions, setAllSubmissions] = useState<FacultySubmissionWithRelations[]>([]);
  const [evalData, setEvalData] = useState({ score: "", notes: "" });
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [openEvalDialog, setOpenEvalDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const activeCycle = await getActiveAppraisalCycle();
      setCycle(activeCycle);

      if (user?.role === "FACULTY") {
        const profile = await getFacultyProfile();
        setFacultyProfile(profile);
        if (activeCycle && profile) {
          const sub = await getFacultySubmission(activeCycle.id);
          setSubmission(sub);
          if (sub?.dataJson) {
            setFormData(sub.dataJson as any);
          }
        }
      } else if (["MANAGER", "HR", "ADMIN", "SUPER_ADMIN"].includes(user?.role || "")) {
        if (activeCycle) {
          const subs = await getAllSubmissions(activeCycle.id);
          setAllSubmissions(subs as FacultySubmissionWithRelations[]);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCycle() {
    try {
      const c = await createMockAppraisalCycle();
      setCycle(c);
      toast.success("Created new appraisal cycle");
    } catch (e) {
      toast.error("Failed to create cycle");
    }
  }

  async function handleFacultySubmit() {
    if (!cycle || !facultyProfile) return;
    try {
      setIsSubmitting(true);
      const sub = await submitAppraisal(cycle.id, formData);
      setSubmission(sub);
      toast.success("Appraisal submitted successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit appraisal");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEvaluate(sub: any) {
    if (!cycle) return;
    try {
      setIsEvaluating(true);
      await evaluateSubmission(sub.id, Number(evalData.score), evalData.notes);
      toast.success("Evaluation saved");
      setOpenEvalDialog(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to evaluate");
    } finally {
      setIsEvaluating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Faculty Appraisal</h1>
          <p className="text-muted-foreground mt-1">
            Manage your annual performance appraisal process.
          </p>
        </div>
        {!cycle && ["MANAGER", "HR", "ADMIN"].includes(user.role) && (
          <Button onClick={handleCreateCycle}>
            <Plus className="mr-2 h-4 w-4" /> Start New Cycle
          </Button>
        )}
      </div>

      {!cycle ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-bold">No Active Cycle</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              There is currently no open appraisal cycle. HR or Managers will start a new cycle when it's time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4 mb-2">
            <Badge variant="outline" className="text-sm py-1">
              Active Cycle: {cycle.name}
            </Badge>
            <Badge variant="secondary" className="text-sm py-1">
              Closes: {new Date(cycle.endDate).toLocaleDateString()}
            </Badge>
          </div>

          {user.role === "FACULTY" && (
            <Card>
              <CardHeader>
                <CardTitle>My Appraisal Submission</CardTitle>
                <CardDescription>Fill out your achievements for the current cycle.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {submission?.status === "SUBMITTED" && (
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-md flex items-center mb-6">
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-medium">You have successfully submitted your appraisal.</p>
                      {submission.evaluation && (
                        <p className="text-sm mt-1 text-emerald-800">
                          Final Score: {submission.evaluation.finalScore} / 10
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teaching Points (Max 10)</Label>
                    <Input 
                      type="number" 
                      value={formData.teachingPoints} 
                      onChange={e => setFormData({...formData, teachingPoints: e.target.value})}
                      disabled={submission?.status === "SUBMITTED"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Research & Publication Points (Max 10)</Label>
                    <Input 
                      type="number" 
                      value={formData.researchPoints} 
                      onChange={e => setFormData({...formData, researchPoints: e.target.value})}
                      disabled={submission?.status === "SUBMITTED"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin & Other Contribution (Max 10)</Label>
                    <Input 
                      type="number" 
                      value={formData.adminPoints} 
                      onChange={e => setFormData({...formData, adminPoints: e.target.value})}
                      disabled={submission?.status === "SUBMITTED"}
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Additional Notes & Achievements</Label>
                  <Textarea 
                    rows={5} 
                    value={formData.notes} 
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    disabled={submission?.status === "SUBMITTED"}
                    placeholder="Briefly describe your key achievements this cycle..."
                  />
                </div>
              </CardContent>
              <CardFooter>
                {submission?.status !== "SUBMITTED" && (
                  <Button onClick={handleFacultySubmit} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Appraisal
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}

          {["MANAGER", "HR", "ADMIN", "SUPER_ADMIN"].includes(user.role) && (
            <Card>
              <CardHeader>
                <CardTitle>Faculty Submissions</CardTitle>
                <CardDescription>Review and evaluate faculty appraisals.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>Faculty Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No submissions yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      allSubmissions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">
                            {sub.faculty.user.name}
                            <div className="text-xs text-muted-foreground">{sub.faculty.employeeCode}</div>
                          </TableCell>
                          <TableCell>{sub.faculty.department || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={sub.evaluation ? "default" : "secondary"}>
                              {sub.evaluation ? "Evaluated" : "Pending Evaluation"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.evaluation ? (
                              <span className="font-bold">{sub.evaluation.finalScore}/10</span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                                <FileText className="h-4 w-4 mr-2" /> 
                                {sub.evaluation ? "View/Edit" : "Evaluate"}
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Evaluate Faculty: {sub.faculty.user.name}</DialogTitle>
                                  <DialogDescription>
                                    Review the submission and provide a final score.
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-md text-sm">
                                    <div>
                                      <span className="text-muted-foreground block text-xs">Teaching</span>
                                      <span className="font-medium">{(sub.dataJson as any)?.teachingPoints || 0} pts</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-xs">Research</span>
                                      <span className="font-medium">{(sub.dataJson as any)?.researchPoints || 0} pts</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block text-xs">Admin</span>
                                      <span className="font-medium">{(sub.dataJson as any)?.adminPoints || 0} pts</span>
                                    </div>
                                    <div className="col-span-3 mt-2">
                                      <span className="text-muted-foreground block text-xs">Self Notes</span>
                                      <p className="mt-1">{(sub.dataJson as any)?.notes || "No notes provided."}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Final Score (Out of 10)</Label>
                                    <Input 
                                      type="number" 
                                      max={10}
                                      defaultValue={sub.evaluation?.finalScore || ""}
                                      onChange={(e) => setEvalData({...evalData, score: e.target.value})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Evaluator Notes</Label>
                                    <Textarea 
                                      rows={3} 
                                      defaultValue={sub.evaluation?.evaluatorNotes || ""}
                                      onChange={(e) => setEvalData({...evalData, notes: e.target.value})}
                                      placeholder="Feedback on performance..."
                                    />
                                  </div>
                                </div>

                                <DialogFooter>
                                  <Button onClick={() => handleEvaluate(sub)} disabled={isEvaluating}>
                                    {isEvaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Evaluation
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
