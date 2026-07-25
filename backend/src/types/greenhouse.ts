export interface GreenhouseJob {
  id: number
  title: string
  location: { name: string }
  departments: Array<{ name: string }>
  offices: Array<{ name: string }>
  absolute_url: string
  internal_job_id: number
  updated_at: string
  content: string
  metadata: Array<{ name: string; value: string }>
}

export interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[]
}

export interface GreenhouseBoard {
  board_token: string
  company_name: string
}

export interface GreenhouseBoardsResponse {
  boards: GreenhouseBoard[]
}
