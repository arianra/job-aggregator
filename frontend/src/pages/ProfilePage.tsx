import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { Job, JobSource } from '../types';

interface Profile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  skills?: { name: string; proficiency: string; years?: number }[];
  experience?: { company: string; title: string; start_date: string; end_date?: string }[];
  education?: { institution: string; degree: string; field?: string }[];
  resume?: { filename: string };
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [uploadMsg, setUploadMsg] = useState('');

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data.data as Profile | null;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('resume', file);
      const { data } = await api.post('/profile/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setUploadMsg(data.aiParsed ? 'Resume parsed with AI!' : 'Resume uploaded (text only).');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      setUploadMsg(`Upload failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const profile = profileData;

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <p className="text-gray-600 mb-4">
            No profile yet. Upload your resume to get started.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploadMsg('Uploading...');
                  uploadMutation.mutate(file);
                }
              }}
              className="text-sm"
            />
            <p className="text-xs text-gray-400 mt-2">PDF, DOCX, or TXT (max 10MB)</p>
          </div>

          {uploadMsg && (
            <p className={`mt-3 text-sm ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {uploadMsg}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>

      <div className="bg-white rounded-lg shadow border border-gray-100 divide-y divide-gray-100">
        {/* Header */}
        <div className="p-6">
          <h2 className="text-xl font-semibold">{profile.name}</h2>
          <div className="text-sm text-gray-500 mt-1 space-x-3">
            {profile.email && <span>{profile.email}</span>}
            {profile.phone && <span>{profile.phone}</span>}
          </div>
          {profile.resume && (
            <p className="text-xs text-gray-400 mt-2">Resume: {profile.resume.filename}</p>
          )}
        </div>

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="p-6">
            <h3 className="font-semibold mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span
                  key={s.name}
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                  title={`${s.proficiency}${s.years ? ` · ${s.years}y` : ''}`}
                >
                  {s.name}
                  {s.years ? ` (${s.years}y)` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {profile.experience && profile.experience.length > 0 && (
          <div className="p-6">
            <h3 className="font-semibold mb-3">Experience</h3>
            <div className="space-y-4">
              {profile.experience.map((e, i) => (
                <div key={i} className="border-l-2 border-blue-200 pl-4">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-gray-600">{e.company}</p>
                  <p className="text-xs text-gray-400">
                    {e.start_date?.slice(0, 7)} – {e.end_date ? e.end_date.slice(0, 7) : 'Present'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {profile.education && profile.education.length > 0 && (
          <div className="p-6">
            <h3 className="font-semibold mb-3">Education</h3>
            <div className="space-y-2">
              {profile.education.map((e, i) => (
                <div key={i}>
                  <p className="font-medium">{e.degree}</p>
                  <p className="text-sm text-gray-600">
                    {e.institution}
                    {e.field ? ` · ${e.field}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload new resume */}
        <div className="p-6">
          <h3 className="font-semibold mb-3">Update Resume</h3>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setUploadMsg('Uploading...');
                uploadMutation.mutate(file);
              }
            }}
            className="text-sm"
          />
          {uploadMsg && (
            <p className={`mt-2 text-sm ${uploadMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {uploadMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}