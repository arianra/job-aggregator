import { useState } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent } from '../ui/dialog'
import { Eye, X } from 'lucide-react'
import api from '../../api/client'

interface ResumePdfViewerProps {
  filename: string
}

export function ResumePdfViewer({ filename }: ResumePdfViewerProps) {
  const [open, setOpen] = useState(false)
  // NOTE: must be the absolute backend URL. A relative '/api/...' path goes
  // through the Vite dev proxy, which strips the /api prefix, and the backend
  // has no such route ("Cannot GET /profile/resume-pdf").
  const pdfUrl = `${api.defaults.baseURL}/profile/resume-pdf`

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" />
        View PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium">{filename}</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src={pdfUrl} className="w-full h-full border-0" title={filename} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
