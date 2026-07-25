"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import {
  getJobPostings,
  getInternships,
  applyForJob,
  logInternship,
  createJobPosting,
  getCompanies,
  seedPlacementsData,
  getAllApplications,
  getMyStudentProfile,
  getMyApplications,
  withdrawApplication,
} from "./actions";
import { ApplicationsBoard } from "./applications-board";
import { APP_STATUS_META } from "@/lib/application-meta";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Company } from "@prisma/client";
import { toast } from "sonner";
import type { JobPostingWithRelations, InternshipWithRelations, JobApplicationWithRelations } from "@/lib/types";

export default function PlacementsPage() {
  const { user } = useAuth();
  
  const [jobPostings, setJobPostings] = useState<JobPostingWithRelations[]>([]);
  const [internships, setInternships] = useState<InternshipWithRelations[]>([]);
  const [applications, setApplications] = useState<JobApplicationWithRelations[]>([]);
  const [myApplications, setMyApplications] = useState<Awaited<ReturnType<typeof getMyApplications>>>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  
  const [internshipCompany, setInternshipCompany] = useState("");
  const [designation, setDesignation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (user?.role === 'STUDENT') {
        const studentProfile = await getMyStudentProfile();
        if (studentProfile) {
          setStudentProfileId(studentProfile.id);
          const [myInternships, myApps] = await Promise.all([getInternships(), getMyApplications()]);
          setInternships(myInternships as InternshipWithRelations[]);
          setMyApplications(myApps);
        }
        const jobs = await getJobPostings();
        setJobPostings(jobs as JobPostingWithRelations[]);
      } else if (user?.role === 'HR' || user?.role === 'ADMIN') {
        const [jobs, apps, comps, ints] = await Promise.all([
          getJobPostings(),
          getAllApplications(),
          getCompanies(),
          getInternships(),
        ]);
        setJobPostings(jobs as JobPostingWithRelations[]);
        setInternships(ints as InternshipWithRelations[]);
        setApplications(apps as JobApplicationWithRelations[]);
        setCompanies(comps as Company[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleSeed = async () => {
    await seedPlacementsData();
    fetchData();
  };

  const handleApply = async (jobId: string) => {
    if (!studentProfileId) return toast.error("Student profile not found! Please make sure you have a student profile created.");
    const res = await applyForJob(jobId);
    if (!res?.success) {
      toast.error("Failed to apply: " + res?.error);
    } else {
      toast.success("Applied successfully!");
      fetchData();
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !title || !description || !deadline) return;
    try {
      await createJobPosting({
        companyId,
        title,
        description,
        deadline: new Date(deadline),
      });
      toast.success("Job posting created successfully!");
      setCompanyId("");
      setTitle("");
      setDescription("");
      setDeadline("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create job posting");
    }
  };

  const handleLogInternship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentProfileId || !internshipCompany || !startDate || !endDate) return;
    const res = await logInternship({
      companyName: internshipCompany,
      designation,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    if (!res?.success) {
      toast.error("Failed to log internship: " + res?.error);
      return;
    }
    toast.success("Internship logged successfully!");
    setInternshipCompany("");
    setDesignation("");
    setStartDate("");
    setEndDate("");
    fetchData();
  };

  if (!user) return null;
  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Placements & Internships</h1>
        <Button onClick={handleSeed} variant="outline">Seed Placements Data</Button>
      </div>

      {user.role === 'STUDENT' ? (
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList>
            <TabsTrigger value="jobs">Job Postings</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="internships">My Internships</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>My Applications</CardTitle>
                <CardDescription>Track every stage of your applications — from Applied to Offer.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myApplications.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            You haven&apos;t applied to any jobs yet.
                          </TableCell>
                        </TableRow>
                      )}
                      {myApplications.map((app) => {
                        const meta = APP_STATUS_META[app.status];
                        return (
                          <TableRow key={app.id}>
                            <TableCell className="font-medium">{app.jobPosting?.title}</TableCell>
                            <TableCell>{app.jobPosting?.company?.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(app.appliedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("border", meta.badge)}>
                                <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", meta.dot)} />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {!meta.terminal && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    if (!confirm("Withdraw this application? This cannot be undone.")) return;
                                    const res = await withdrawApplication(app.id);
                                    if (res.success) {
                                      toast.success("Application withdrawn");
                                      fetchData();
                                    } else toast.error(res.error);
                                  }}
                                >
                                  Withdraw
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="jobs">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
              {jobPostings.map((job) => {
                const hasApplied = job.applications?.some((app: any) => app.studentProfileId === studentProfileId);
                return (
                  <Card key={job.id}>
                    <CardHeader>
                      <CardTitle>{job.title}</CardTitle>
                      <CardDescription>{job.company?.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{job.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : "N/A"}</span>
                        {hasApplied ? (
                          <Button disabled variant="secondary">Applied</Button>
                        ) : (
                          <Button onClick={() => handleApply(job.id)}>Apply Now</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {jobPostings.length === 0 && <p className="text-muted-foreground text-sm">No job postings available.</p>}
            </div>
          </TabsContent>

          <TabsContent value="internships">
            <Card className="mt-4 max-w-xl">
              <CardHeader>
                <CardTitle>Log New Internship</CardTitle>
                <CardDescription>Keep track of your internship experience</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogInternship} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" value={internshipCompany} onChange={(e) => setInternshipCompany(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                    </div>
                  </div>
                  <Button type="submit">Log Internship</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>My Internships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internships.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.companyName}</TableCell>
                        <TableCell>{i.designation || '-'}</TableCell>
                        <TableCell>{new Date(i.startDate).toLocaleDateString()} - {new Date(i.endDate).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="secondary">{i.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {internships.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No internships logged.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="applications" className="w-full">
          <TabsList>
            <TabsTrigger value="applications">Applications Pipeline</TabsTrigger>
            <TabsTrigger value="dashboard">Postings Overview</TabsTrigger>
            <TabsTrigger value="create">Create Job Posting</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <ApplicationsBoard applications={applications} onChanged={fetchData} />
          </TabsContent>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Job Postings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Applications</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobPostings.map(job => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell>{job.company?.name}</TableCell>
                          <TableCell>{job.applications?.length || 0}</TableCell>
                        </TableRow>
                      ))}
                      {jobPostings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No jobs posted.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map(app => (
                        <TableRow key={app.id}>
                          <TableCell>{app.student?.user?.name || app.student?.rollNo || 'Unknown'}</TableCell>
                          <TableCell>{app.jobPosting?.title}</TableCell>
                          <TableCell><Badge variant="outline">{app.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {applications.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No applications yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="create">
            <Card className="mt-4 max-w-xl">
              <CardHeader>
                <CardTitle>Create New Job Posting</CardTitle>
                <CardDescription>Post a new opportunity for students</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateJob} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Select value={companyId} onValueChange={(val) => val && setCompanyId(val)} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
                  </div>
                  <Button type="submit">Publish Job Posting</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
