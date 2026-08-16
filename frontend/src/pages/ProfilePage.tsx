import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, User, Briefcase, GraduationCap, Wrench, Loader2 } from 'lucide-react'
import { useProfile, primaryResumeOf } from '../hooks/useProfile'
import { useResume } from '../hooks/useResumes'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { EmptyState } from '../components/ui/EmptyState'

/**
 * Profile page (E6.12 — ADR-0008): derived from the PRIMARY resume.
 * Shows the person's identity + a read-only view of the primary resume's
 * sections (summary/skills/experience/education). With no primary resume (or
 * no resume at all) it renders an empty state that routes to Resume Studio.
 */
export function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const [openResumeId, setOpen] = useState<string | undefined>()
  const primary = primaryResumeOf(profile)
  const { data: primaryWithData } = useResume(openResumeId ?? primary?.id ?? undefined)

  // Ensure we open the primary resume's data once we know its id.
  useEffect(() => {
    if (primary && openResumeId !== primary.id) setOpen(primary.id)
  }, [primary, openResumeId])

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const hasAnyResume = !!profile && profile.resumes.length > 0

  if (!profile || !primary) {
    return (
      <EmptyState
        icon={FileText}
        title={hasAnyResume ? 'No primary resume' : 'No resume yet'}
        description={
          hasAnyResume
            ? 'Set one of your resumes as primary to power this profile and job matching.'
            : 'Create your first resume. Your profile is derived from your primary resume.'
        }
        action={
          <Link to="/resume" className="inline-flex">
            <Plus className="mr-2 h-4 w-4" /> Go to Resume Studio
          </Link>
        }
      />
    )
  }

  const doc = primaryWithData?.data

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <User className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold">{doc?.contact.name || profile.name}</div>
            <div className="text-sm text-muted-foreground">
              {[doc?.contact.city, doc?.contact.state, doc?.contact.country]
                .filter(Boolean)
                .join(', ') || 'No location set'}
            </div>
          </div>
          <div className="ml-auto">
            <Badge variant="outline">Primary: {primary.title}</Badge>
          </div>
        </CardContent>
      </Card>

      <Section title="Summary" icon={<Briefcase className="h-4 w-4" />}>
        {doc?.summary ? <p className="whitespace-pre-wrap text-sm">{doc.summary}</p> : '—'}
      </Section>

      <Section title="Skills" icon={<Wrench className="h-4 w-4" />}>
        <div className="space-y-2">
          {Object.entries(doc?.skills ?? {})
            .filter(([, v]) => v?.length)
            .map(([cat, skills]) => (
              <div key={cat}>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{cat}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {skills.map((s, i) => (
                    <Badge key={i} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Experience" icon={<Briefcase className="h-4 w-4" />}>
        <div className="space-y-3">
          {(doc?.experience ?? []).map((e, i) => (
            <div key={i}>
              <div className="font-medium">{e.role}</div>
              <div className="text-xs text-muted-foreground">
                {[e.company, e.dates, e.location].filter(Boolean).join('  ·  ')}
              </div>
              {e.bullets?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {e.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Education" icon={<GraduationCap className="h-4 w-4" />}>
        <div className="space-y-2">
          {(doc?.education ?? []).map((e, i) => (
            <div key={i}>
              <div className="font-medium">{e.degree}</div>
              <div className="text-xs text-muted-foreground">
                {[e.school, e.location, e.year].filter(Boolean).join('  ·  ')}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="text-sm text-muted-foreground">
        Profile is derived from your primary resume. Edit it in the{' '}
        <Link to={`/resume/${primary.id}`} className="underline">
          Resume Studio
        </Link>
        .
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  )
}