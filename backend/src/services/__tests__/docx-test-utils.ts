/**
 * DOCX test helpers (E3) — extract text/structural facts from a .docx Buffer
 * for golden/round-trip assertions. Pure; uses jszip (no disk).
 */
import JSZip from 'jszip'
import type { ResumeDoc } from '@job-aggregator/shared'

/** Ordered paragraph texts from a docx buffer (empty paragraphs included). */
export async function extractDocxParagraphs(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')!.async('string')
  const paras = xml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) ?? []
  return paras.map((p) => {
    const runs = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? []
    return runs
      .map((r) => (r.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) ?? ['', ''])[1])
      .join('')
  })
}

/** True if the document.xml contains a table, drawing or text-box. */
export async function hasComplexLayout(buffer: Buffer): Promise<boolean> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')!.async('string')
  return /<w:tbl|<w:drawing|<w:txbxContent/.test(xml)
}

/** Collapse whitespace for content-equivalence comparisons. */
export function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * The reference ResumeDoc built from the golden cv2026/003 document content.
 * Used as the fixture for golden + round-trip tests.
 */
export function goldenResumeDoc(): ResumeDoc {
  return {
    contact: {
      name: 'Arian Razi',
      email: 'arian99@gmail.com',
      phone: '+1 (707) 771-6645',
      linkedin: 'www.linkedin.com/in/arianvala',
      country: 'United States',
      state: 'California',
      city: 'Vallejo',
      visibility: { email: true, phone: true, linkedin: true },
    },
    summary:
      'Lead Frontend Engineer with 10+ years across e-commerce, fintech, and startups. At Walmart, led the Search/Browse and Deals frontend team and the web performance team; shipped Core Web Vitals work that halved INP, LCP, and CLS on Walmart highest-traffic storefronts and a 52% faster 75th percentile response time. Builds developer tooling that removes friction, most recently an AI orchestration framework that collapses a 12-step manual workflow into a single command. Sets team standards through mentoring, documentation, and automated testing.',
    experience: [
      {
        role: 'Lead Frontend Engineer',
        company: 'Walmart',
        dates: '2022 - Present',
        location: 'Sunnyvale, CA',
        bullets: [
          'Functioned as engineering team lead for the cross-platform frontend Search/Browse & Deals e-commerce channels, and as team lead for the Web Performance team engaged in Core Web Vitals (client & server) optimizations.',
          'Mentored junior engineers and wrote extensive documentation setting standards for code quality, testing, and continuous integration/deployment (CI/CD).',
          'Delivered $153K in annualized infrastructure savings by optimizing server CPU and memory allocation, and increased response times by 52% for 75th percentile.',
          'Architected and implemented advanced performance optimization techniques, prioritizing critical rendering paths, deferring non-essential scripts, and minimizing resource footprints to elevate Web Core Vitals.',
          'Architected a declarative AI agent orchestration framework composing 23+ skills into automated DAG-based workflows, reducing multi-step development processes from 12 manual interventions to single-command execution.',
          'Developed and maintained analytical dashboards and performance graphs utilizing Splunk, Grafana, Prometheus, Open Observe, and DataFusion SQL to support data-informed decision making.',
        ],
      },
      {
        role: 'Lead Frontend Engineer',
        company: 'Ready Responders Inc',
        dates: '2021 - 2022',
        location: 'New Orleans, LA',
        bullets: [
          'Led the design and development of the critical responder UI using ReactJS to streamline and optimize field operations for medical personnel.',
          'Architected and documented the frontend stack built on modern technologies, establishing best practices for React component lifecycle, testing (unit/integration), and code reviews.',
          'Mentored and guided fellow engineers on advanced frontend patterns, performance optimization, and effective collaboration with backend service teams.',
          'Implemented advanced state management and component libraries to ensure a highly responsive and reliable application, essential for emergency response scenarios.',
        ],
      },
      {
        role: 'Senior Frontend engineer',
        company: 'Datameer Inc.',
        dates: '2019 - 2020',
        location: 'San Francisco, CA',
        bullets: [
          'Served as senior Frontend engineer for the newly created SF team working on a new product launch.',
          'Effectively communicated development effort with emphasis on team collaboration to achieve sprint goals and strengthen team output, improved sprint velocity by 70%.',
          'Contributed to creating cross-discipline workflows, architecture decision, UI components, and delivering features in a timely manner.',
          'Directed massive effort to internationalize content and collaborated with content team to expand their ability to write content within the app.',
        ],
      },
      {
        role: 'Senior Frontend Engineer',
        company: 'Wells Fargo (contract)',
        dates: '2018 - 2019',
        location: 'San Francisco, CA',
        bullets: [
          'Served as senior Frontend engineer, spearheading the Frontend development for a greenfield internal project, an AI data science platform.',
          'Interfaced with data science, technical and QA teams to understand challenges, needs and strategic direction.',
          'Built overall architecture for the Frontend, ensuring security, performance and user-centered production ready code.',
        ],
      },
      {
        role: 'Frontend Engineer',
        company: 'Capgemini / Virtual Affairs / InSided Media',
        dates: '2013 - 2018',
        location: 'Amsterdam, The Netherlands',
        bullets: [
          'Led a mobile-first team targeting mobile user KPIs; increased completion metrics by more than 50%.',
          'Built an embedding API used across all in-house CRM products; first implementation shipped on Volkswagen e-commerce portal.',
          'Implemented real-user monitoring for API integrations over WebSockets, enabling instant error detection across client platforms and cutting response time to integration issues by 40%.',
          'Launched Findio, a new digital financing channel for a large financial institution, on schedule in 2015.',
        ],
      },
      {
        role: 'Internship Frontend Engineer',
        company: 'Various Organizations',
        dates: '2011 - 2013',
        location: 'Amsterdam, The Netherlands',
        bullets: [
          'Wrote code for different projects on commission basis, as well as a half year internship.',
          'Collaborated on big-scale projects for clients including Fox News, KLM, and the Dutch municipality Haarlemmermeer.',
          'Gained experience in UI development technologies, with a proficiency in Javascript, HTML5 and CSS3.',
        ],
      },
    ],
    education: [
      {
        degree: 'Bachelor of Arts in Communication/Media Design',
        school: 'Hogeschool van Amsterdam',
        location: 'Amsterdam, The Netherlands',
        year: '2012',
      },
    ],
    skills: {
      Development: [
        'Web applications',
        'Typescript',
        'React',
        'Node',
        'GraphQL',
        'NextJS',
        'React-Query',
        'Redux',
        'PromQL',
        'DataFusion SQL',
        'HTML & CSS',
      ],
      Process: [
        'Architecture',
        'Unit Testing',
        'Tooling/Automation',
        'UI/UX',
        'Agile',
        'Scrum',
        'Maintainability',
        'Data analytics',
        'Realtime monitoring',
      ],
    },
    certifications: [],
    sections: {
      order: ['contact', 'summary', 'experience', 'education', 'skills', 'certifications'],
      visibility: { certifications: false },
    },
    settings: { fontSize: 6.5, lineHeight: 1.42, spacing: 1, typeface: 'serif', paperA4: false },
  }
}