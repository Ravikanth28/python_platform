import EditorTour from './EditorTour'
import { useAuth } from '../../context/AuthContext'

const P = 'right'   // tour cards sit to the right of the sidebar items

const STUDENT_STEPS = [
  { title: 'Welcome to CodeForge 👋', body: "Here's a quick 1-minute tour of your learning hub — what each section in the sidebar does." },
  { selector: '[data-tour="nav-dashboard"]', placement: P, title: 'Dashboard', body: 'Your progress, recent activity and a skill chart at a glance.' },
  { selector: '[data-tour="nav-lessons"]', placement: P, title: 'Lessons', body: 'Learn Python step by step — read a concept, run real code, then check yourself.' },
  { selector: '[data-tour="nav-notes"]', placement: P, title: 'Notes', body: 'Study materials your instructor shares — PDFs, videos and links.' },
  { selector: '[data-tour="nav-classroom"]', placement: P, title: 'Classroom', body: 'Your classes and assignments. Join a class using an invite code from your teacher.' },
  { selector: '[data-tour="nav-challenges"]', placement: P, title: 'Challenges', body: 'Quick brain-teasers: Predict-the-Output and Fix-the-Bug — sharpen your instincts.' },
  { selector: '[data-tour="nav-practice"]', placement: P, title: 'Practice', body: 'Solve problems in the live editor — Run, Submit, and Visualize your code.' },
  { selector: '[data-tour="nav-tests"]', placement: P, title: 'Tests', body: 'Timed, proctored assessments assigned to you.' },
  { selector: '[data-tour="nav-reports"]', placement: P, title: 'Reports', body: 'Your submission history, scores, and a downloadable completion certificate.' },
  { selector: '[data-tour="nav-analytics"]', placement: P, title: 'Analytics', body: 'See your strengths and weak topics, and your progress over time.' },
  { selector: '[data-tour="nav-profile"]', placement: 'top', title: 'Your profile', body: 'Click your name to edit your details, add a phone number, or change your password.' },
  { title: "You're all set! 🚀", body: 'Start with Lessons, then practice in Practice & Challenges. Replay this tour anytime from the ? button at the top.' },
]

const ADMIN_STEPS = [
  { title: 'Welcome, Admin 👋', body: "A quick tour of the admin portal — here's everything you can manage." },
  { selector: '[data-tour="nav-dashboard"]', placement: P, title: 'Dashboard', body: 'Platform overview: students, submissions, acceptance rate and storage.' },
  { selector: '[data-tour="nav-lessons"]', placement: P, title: 'Lessons', body: 'Author the interactive curriculum — or let AI draft a full, detailed lesson for any topic.' },
  { selector: '[data-tour="nav-notes"]', placement: P, title: 'Notes', body: 'Upload study materials (PDF/DOCX) or share YouTube videos and links.' },
  { selector: '[data-tour="nav-classroom"]', placement: P, title: 'Classroom', body: "Create classes, assign problem sets, auto-add AI assignments on a schedule, and track who's done." },
  { selector: '[data-tour="nav-students"]', placement: P, title: 'Students', body: 'All student details in one table — reset a forgotten password or remove an account.' },
  { selector: '[data-tour="nav-challenges"]', placement: P, title: 'Challenges', body: 'Author Predict/Fix-the-Bug, AI-generate them in one click, or auto-add daily/weekly.' },
  { selector: '[data-tour="nav-practice"]', placement: P, title: 'Practice Mode', body: 'Create & manage practice problems with test cases and optional starter code.' },
  { selector: '[data-tour="nav-tests"]', placement: P, title: 'Test Mode', body: 'Create timed, proctored assessments (tab-switch detection, fullscreen, copy-paste lock).' },
  { selector: '[data-tour="nav-live"]', placement: P, title: 'Live Tests', body: "Monitor tests in real time — who's attending right now, who's done, and who hasn't started." },
  { selector: '[data-tour="nav-reports"]', placement: P, title: 'Reports', body: 'The full gradebook — filter, leave feedback, and export to Excel.' },
  { selector: '[data-tour="nav-analytics"]', placement: P, title: 'Analytics', body: "Cohort insights: hardest problems, weak topics, and who's stuck." },
  { selector: '[data-tour="nav-system"]', placement: P, title: 'System', body: 'Live service health, a real-time request log, storage usage, and database backups.' },
  { selector: '[data-tour="nav-profile"]', placement: 'top', title: 'Your profile', body: 'Click your name to edit your details or change your password.' },
  { title: "That's the tour! 🚀", body: 'Tip: use “AI generate” on Lessons & Challenges to fill content fast. Replay this tour anytime from the ? button at the top.' },
]

export default function PlatformTour({ open, onClose }) {
  const { user } = useAuth()
  const steps = user?.role === 'admin' ? ADMIN_STEPS : STUDENT_STEPS
  return <EditorTour open={open} steps={steps} onClose={onClose} />
}
