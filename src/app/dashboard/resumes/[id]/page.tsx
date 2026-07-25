"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, use } from "react";
import { getResume, updateResume, deleteResume } from "../actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function EditResumePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [resumeData, setResumeData] = useState<any>({
    personalDetails: { name: "", email: "", phone: "", address: "" },
    education: [],
    experience: [],
    skills: []
  });

  useEffect(() => {
    if (user?.role !== "STUDENT") {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const resume = await getResume(id);
        if (!resume) {
          router.push("/dashboard/resumes");
          return;
        }
        setTitle(resume.title);
        if (resume.dataJson) {
          setResumeData(resume.dataJson);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user, router]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const result = await updateResume(id, title, resumeData);
      if (result.success) {
        alert("Resume saved successfully.");
      } else {
        alert(result.error || "Failed to save resume.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to save resume.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this resume permanently? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteResume(id);
      router.push("/dashboard/resumes");
    } catch (error) {
      console.error(error);
      alert("Failed to delete resume.");
      setDeleting(false);
    }
  };

  // ---- Handlers for arrays ----
  const addEducation = () => {
    setResumeData({
      ...resumeData,
      education: [...(resumeData.education || []), { institution: "", degree: "", startYear: "", endYear: "", grade: "" }]
    });
  };

  const updateEducation = (index: number, field: string, value: string) => {
    const newEdu = [...(resumeData.education || [])];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setResumeData({ ...resumeData, education: newEdu });
  };

  const removeEducation = (index: number) => {
    const newEdu = [...(resumeData.education || [])];
    newEdu.splice(index, 1);
    setResumeData({ ...resumeData, education: newEdu });
  };

  const addExperience = () => {
    setResumeData({
      ...resumeData,
      experience: [...(resumeData.experience || []), { company: "", role: "", startDate: "", endDate: "", description: "" }]
    });
  };

  const updateExperience = (index: number, field: string, value: string) => {
    const newExp = [...(resumeData.experience || [])];
    newExp[index] = { ...newExp[index], [field]: value };
    setResumeData({ ...resumeData, experience: newExp });
  };

  const removeExperience = (index: number) => {
    const newExp = [...(resumeData.experience || [])];
    newExp.splice(index, 1);
    setResumeData({ ...resumeData, experience: newExp });
  };

  const updateSkills = (value: string) => {
    const skillsArray = value.split(",").map(s => s.trim());
    setResumeData({ ...resumeData, skills: skillsArray });
  };

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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/resumes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Edit Resume</h1>
            <p className="text-muted-foreground mt-1">Update your resume details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <Label className="text-xs mb-1">Resume Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-64"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || deleting} className="mt-5">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Resume
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting} className="mt-5">
            {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-12 lg:col-span-8 space-y-6">
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
            </TabsList>
            
            {/* Personal Details */}
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Details</CardTitle>
                  <CardDescription>Basic contact information for your resume.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        value={resumeData.personalDetails?.name || ""}
                        onChange={(e) => setResumeData({...resumeData, personalDetails: {...resumeData.personalDetails, name: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" type="email"
                        value={resumeData.personalDetails?.email || ""}
                        onChange={(e) => setResumeData({...resumeData, personalDetails: {...resumeData.personalDetails, email: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        value={resumeData.personalDetails?.phone || ""}
                        onChange={(e) => setResumeData({...resumeData, personalDetails: {...resumeData.personalDetails, phone: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input 
                        id="address" 
                        value={resumeData.personalDetails?.address || ""}
                        onChange={(e) => setResumeData({...resumeData, personalDetails: {...resumeData.personalDetails, address: e.target.value}})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Education */}
            <TabsContent value="education">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Education</CardTitle>
                    <CardDescription>Add your educational background.</CardDescription>
                  </div>
                  <Button onClick={addEducation} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(!resumeData.education || resumeData.education.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No education added yet.</p>
                  )}
                  {resumeData.education?.map((edu: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg relative space-y-4">
                      <Button 
                        variant="ghost" size="icon" 
                        className="absolute right-2 top-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeEducation(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Institution</Label>
                          <Input value={edu.institution} onChange={(e) => updateEducation(index, "institution", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Degree / Program</Label>
                          <Input value={edu.degree} onChange={(e) => updateEducation(index, "degree", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Start Year</Label>
                            <Input value={edu.startYear} onChange={(e) => updateEducation(index, "startYear", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>End Year</Label>
                            <Input value={edu.endYear} onChange={(e) => updateEducation(index, "endYear", e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Grade / CGPA</Label>
                          <Input value={edu.grade} onChange={(e) => updateEducation(index, "grade", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Experience */}
            <TabsContent value="experience">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Experience</CardTitle>
                    <CardDescription>Add your internships or job experience.</CardDescription>
                  </div>
                  <Button onClick={addExperience} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(!resumeData.experience || resumeData.experience.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No experience added yet.</p>
                  )}
                  {resumeData.experience?.map((exp: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg relative space-y-4">
                      <Button 
                        variant="ghost" size="icon" 
                        className="absolute right-2 top-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeExperience(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Company</Label>
                          <Input value={exp.company} onChange={(e) => updateExperience(index, "company", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Input value={exp.role} onChange={(e) => updateExperience(index, "role", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input value={exp.startDate} onChange={(e) => updateExperience(index, "startDate", e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input value={exp.endDate} onChange={(e) => updateExperience(index, "endDate", e.target.value)} />
                          </div>
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                          <Label>Description</Label>
                          <Textarea 
                            value={exp.description} 
                            onChange={(e) => updateExperience(index, "description", e.target.value)} 
                            placeholder="Describe your responsibilities and achievements..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Skills */}
            <TabsContent value="skills">
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>List your technical and soft skills (comma separated).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Skills</Label>
                      <Textarea 
                        value={(resumeData.skills || []).join(", ")}
                        onChange={(e) => updateSkills(e.target.value)}
                        placeholder="e.g. JavaScript, React, Node.js, Project Management"
                        rows={4}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(resumeData.skills || []).filter((s: string) => s.trim() !== "").map((skill: string, index: number) => (
                        <span key={index} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>

        {/* Live Preview Sidebar */}
        <div className="md:col-span-12 lg:col-span-4">
          <div className="sticky top-6">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b pb-4 shrink-0">
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <CardDescription>How your resume looks</CardDescription>
              </CardHeader>
              <CardContent className="p-4 overflow-y-auto flex-grow bg-muted/20">
                {/* Minimalist Resume Preview */}
                <div className="bg-white text-black p-6 shadow-sm min-h-full border">
                  <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold uppercase tracking-wide">
                      {resumeData.personalDetails?.name || "Your Name"}
                    </h2>
                    <div className="text-xs text-gray-600 mt-1 flex justify-center flex-wrap gap-2">
                      <span>{resumeData.personalDetails?.email || "email@example.com"}</span>
                      {resumeData.personalDetails?.phone && <span>• {resumeData.personalDetails.phone}</span>}
                      {resumeData.personalDetails?.address && <span>• {resumeData.personalDetails.address}</span>}
                    </div>
                  </div>

                  {resumeData.education && resumeData.education.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2">Education</h3>
                      <div className="space-y-2">
                        {resumeData.education.map((edu: any, i: number) => (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between font-semibold">
                              <span>{edu.institution || "Institution Name"}</span>
                              <span>{edu.startYear} - {edu.endYear || "Present"}</span>
                            </div>
                            <div className="flex justify-between text-gray-700">
                              <span>{edu.degree || "Degree"}</span>
                              <span>{edu.grade && `Grade: ${edu.grade}`}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resumeData.experience && resumeData.experience.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2">Experience</h3>
                      <div className="space-y-3">
                        {resumeData.experience.map((exp: any, i: number) => (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between font-semibold">
                              <span>{exp.company || "Company Name"}</span>
                              <span>{exp.startDate} - {exp.endDate || "Present"}</span>
                            </div>
                            <div className="italic text-gray-700 mb-1">{exp.role || "Role"}</div>
                            {exp.description && (
                              <p className="text-gray-600 whitespace-pre-wrap">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resumeData.skills && resumeData.skills.length > 0 && resumeData.skills.some((s: string) => s.trim() !== "") && (
                    <div>
                      <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2">Skills</h3>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {resumeData.skills.filter((s: string) => s.trim() !== "").join(" • ")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
