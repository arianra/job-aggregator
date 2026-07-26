import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import type { Job, JobSource } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Upload, User, Briefcase, GraduationCap, FileText } from 'lucide-react'

interface Profile {
  id: string
  name: string
  email?: string
  phone?: string
  skills?: { name: string; proficiency: string; years?: number }[]
  experience?: { company: string; title: string; start_date: string; end_date?: string }[]
  education?: { institution: string; degree: string; field?: string }[]
  resume?: { filename: string }
}

export function ProfilePage() {
  const queryClient = useQueryClient()
  const [uploadMsg, setUploadMsg] = useState('')

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile')
      return data.data as Profile | null
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('resume', file)
      const { data } = await api.post('/profile/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      setUploadMsg(data.aiParsed ? 'Resume parsed with AI!' : 'Resume uploaded (text only).')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err: Error) => {
      setUploadMsg(`Upload failed: ${err.message}`)
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
          <p className="text-muted-foreground mt-2">No profile yet. Upload your resume to get started.</p>
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
                  if (file) {
                    setUploadMsg('Uploading...')
                    uploadMutation.mutate(file)
                  }
                }}
                className="max-w-xs mx-auto"
              />
              <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, or TXT (max 10MB)</p>
            </div>

            {uploadMsg && (
              <div className="mt-4">
                <Badge variant={uploadMsg.includes('failed') ? 'destructive' : 'default'}>
                  {uploadMsg}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your professional information</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="experience">Experience</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
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
                  if (file) {
                    setUploadMsg('Uploading...')
                    uploadMutation.mutate(file)
                  }
                }}
              />
              {uploadMsg && (
                <Badge variant={uploadMsg.includes('failed') ? 'destructive' : 'default'}>
                  {uploadMsg}
                </Badge>
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
                        {e.start_date?.slice(0, 7)} – {e.end_date ? e.end_date.slice(0, 7) : 'Present'}
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
      </Tabs>
    </div>
  )
}
