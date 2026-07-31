import { useState } from 'react'
import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, Eye } from 'lucide-react'
import api from '../../api/client'

interface ResumePdfViewerProps {
  filename: string
}

export function ResumePdfViewer({ filename }: ResumePdfViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  const pdfUrl = `${api.defaults.baseURL}/profile/resume-pdf`

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          View Original PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {filename}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 w-full">
          {isOpen && (
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <Viewer fileUrl={pdfUrl} plugins={[defaultLayoutPluginInstance]} />
            </Worker>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
