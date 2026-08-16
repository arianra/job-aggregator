import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import type { ResumeMeta, ProfilePreferences, Location } from '../types'

export interface ProfileIdentity {
  id: string
  name: string
  email?: string
  phone?: string
  location?: Location
  preferences: ProfilePreferences
  resumes: ResumeMeta[]
  created_at: string
  updated_at: string
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get<{ data: ProfileIdentity | null }>('/profile')
      return data.data
    },
  })
}

export function primaryResumeOf(p: ProfileIdentity | null | undefined): ResumeMeta | undefined {
  return p?.resumes.find((r) => r.primary && r.status !== 'ARCHIVED')
}