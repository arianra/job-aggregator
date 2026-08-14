import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { reparseProfile } from '../api/client'
import { notify } from '../lib/notify'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { ActionAlert } from '../components/ActionAlert'
import { Upload, User, Briefcase, GraduationCap, FileText } from 'lucide-react'
import { ResumePdfViewer } from '../components/pdf/ResumePdfViewer'

type ParseStatus = 'parsed' | 'parse_failed' | 'not_configured'

interface Profile {
  id: string
  name: string
  email?: string
  phone?: string
  skills?: { name: string; proficiency: string; years?: number }[]
  experience?: { company: string; title: string; start_date: string; end_date?: string }[]
  education?: { institution: string; degree: string; field?: string }[]
  resume?: {
    filename: string
    parsed_text?: string
    parse_status?: ParseStatus
    quality_score?: number
    quality_issues?: string[]
    quality_suggestions?: string[]
  }
}

/**
 * Derive the AI-parse state of the stored resume. Prefers the persisted
 * `parse_status` field; falls back to inference for legacy rows written
 * before the field existed.
 */
function deriveParseStatus(profile: Profile): ParseStatus | undefined {
  const resume = profile.resume
  if (!resume?.parsed_text) return undefined
  if (resume.parse_status) return resume.parse_status
  // Legacy row: if the AI had worked, we'd have a real name and content.
  const aiWorked =
    profile.name &&
    profile.name !== 'Unnamed' &&
    ((profile.skills && profile.skills.length > 0) ||
      (profile.experience && profile.experience.length > 0))
  return aiWorked ? 'parsed' : 'parse_failed'
}

export function ProfilePage() {
  const queryClient = useQueryClient()
  const [resumeText, setResumeText] = useState('')

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile')
      return data.data as Profile | null
    },
  })

  // Initialize resumeText when profile loads
  useEffect(() => {
    if (profileData?.resume?.parsed_text) {
      setResumeText(profileData.resume.parsed_text)
    }
  }, [profileData])

  // Upload — transient feedback via toasts. Failures toast automatically via
  // the global MutationCache policy; degraded success (AI parse failed) is
  // announced with a warning toast AND surfaced persistently below via the
  // parse_status-driven ActionAlert.
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('resume', file)
      const { data } = await api.post('/profile/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data as {
        success: boolean
        data: Profile
        aiParsed: boolean
        warnings?: { code: string; message: string }[]
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      if (res.aiParsed) {
        notify.success('Resume parsed with AI')
      } else {
        notify.warning('Resume saved as text only', {
          description: res.warnings?.[0]?.message ?? 'AI parsing did not run',
        })
      }
    },
  })

  // Re-parse — recovery path for degraded profiles. Never a silent outcome.
  const reparseMutation = useMutation({
    mutationFn: () => reparseProfile(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      notify.success('Resume parsed with AI')
    },
  })

  const saveResumeTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.put('/profile/resume-text', { text })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      notify.success('Resume text saved')
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const profile = profileData

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground mt-2">
            No profile yet. Upload your resume to get started.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <Input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                }}
                className="max-w-xs mx-auto"
              />
              <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, or TXT (max 10MB)</p>
              {uploadMutation.isPending && (
                <p className="text-sm text-muted-foreground mt-3">Uploading…</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const parseStatus = deriveParseStatus(profile)
  const needsReparse = parseStatus !== undefined && parseStatus !== 'parsed'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your professional information</p>
      </div>

      {/* Persistent degraded-success surface: lives with the resource, not the
          moment of failure, so a profile that failed AI parsing once is never
          stuck text-only forever. */}
      {needsReparse && (
        <ActionAlert
          variant={parseStatus === 'not_configured' ? 'default' : 'destructive'}
          title={
            parseStatus === 'not_configured'
              ? 'Resume saved without AI parsing'
              : 'AI parsing failed for this resume'
          }
          description={
            parseStatus === 'not_configured'
              ? 'The AI parser is not configured, so your resume was saved as text only. Skills and experience were not extracted.'
              : 'Your resume was saved as text only — skills and experience were not extracted. You can retry AI parsing now; the stored text is kept.'
          }
          action={{
            label: 'Retry AI parse',
            onClick: () => reparseMutation.mutate(),
            pending: reparseMutation.isPending,
          }}
        />
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="resume-text">Resume Text</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="text-lg font-semibold mt-1">{profile.name}</p>
              </div>

              {(profile.email || profile.phone) && (
                <div className="grid grid-cols-2 gap-4">
                  {profile.email && (
                    <div>
                      <Label>Email</Label>
                      <p className="text-muted-foreground mt-1">{profile.email}</p>
                    </div>
                  )}
                  {profile.phone && (
                    <div>
                      <Label>Phone</Label>
                      <p className="text-muted-foreground mt-1">{profile.phone}</p>
                    </div>
                  )}
                </div>
              )}

              {profile.resume && (
                <div>
                  <Label>Resume</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{profile.resume.filename}</p>
                    {profile.resume.filename.toLowerCase().endsWith('.pdf') && (
                      <ResumePdfViewer filename={profile.resume.filename} />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                }}
              />
              {uploadMutation.isPending && (
                <p className="text-sm text-muted-foreground">Uploading…</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills">
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.skills && profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <Badge key={s.name} variant="secondary" className="text-sm">
                      {s.name}
                      {s.years ? ` (${s.years}y)` : ''}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No skills listed</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experience">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.experience && profile.experience.length > 0 ? (
                <div className="space-y-4">
                  {profile.experience.map((e, i) => (
                    <div key={i} className="border-l-2 border-primary pl-4 py-2">
                      <p className="font-semibold">{e.title}</p>
                      <p className="text-sm text-muted-foreground">{e.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.start_date?.slice(0, 7)} –{' '}
                        {e.end_date ? e.end_date.slice(0, 7) : 'Present'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No experience listed</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.education && profile.education.length > 0 ? (
                <div className="space-y-4">
                  {profile.education.map((e, i) => (
                    <div key={i}>
                      <p className="font-semibold">{e.degree}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.institution}
                        {e.field ? ` · ${e.field}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No education listed</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume-text">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resume Text
                </div>
                {profile.resume?.quality_score && (
                  <Badge variant={profile.resume.quality_score >= 80 ? 'default' : 'secondary'}>
                    Quality: {profile.resume.quality_score}%
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Edit the extracted text from your resume. This will be used for ATS optimization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.resume?.filename && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{profile.resume.filename}</span>
                </div>
              )}

              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Your resume text will appear here after uploading a PDF..."
                className="min-h-[400px] font-mono text-sm"
              />

              {profile.resume?.quality_issues && profile.resume.quality_issues.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Issues Found:</Label>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {profile.resume.quality_issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.resume?.quality_suggestions &&
                profile.resume.quality_suggestions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Suggestions:</Label>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {profile.resume.quality_suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">→</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => saveResumeTextMutation.mutate(resumeText)}
                  disabled={saveResumeTextMutation.isPending || !resumeText.trim()}
                >
                  {saveResumeTextMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (profile.resume?.parsed_text) {
                      setResumeText(profile.resume.parsed_text)
                    }
                  }}
                  disabled={!profile.resume?.parsed_text}
                >
                  Reset to Original
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
